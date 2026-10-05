# Household Architecture

Envelope uses Google Auth plus Firestore root metadata to keep private ledgers isolated and to support explicit household sharing.

## Core invariants

- Every signed-in Google user has a private cloud household created automatically on first sign-in.
- The active dashboard is selected from `/users/{uid}.activeLedgerId`.
- Household IDs are internal generated IDs and are not join links.
- Firestore rules are the security boundary. Client-side checks improve UX, but rules must reject unauthorized reads and writes.
- The reserved local ID `local` is never a cloud household ID.
- Ledger contents are represented by immutable events under the household event collection.

## Firestore model

```text
/users/{uid}
  uid
  email
  displayName
  photoURL
  privateLedgerId
  activeLedgerId
  createdAt
  updatedAt

/households/{householdId}
  id
  name
  owner_uid
  owner_email
  created_by
  allowed_emails[]
  member_uids[]
  sync_version
  schema_version
  created_at
  updated_at
  updated_by_uid
  first_time_intro_completed
  first_time_intro_completed_at

/households/{householdId}/events/{eventId}
  immutable ledger event document

/householdInvitations/{householdId}__{inviteeEmail}
  household_id
  household_name
  inviter_uid
  inviter_email
  invitee_email
  invitee_uid
  status: pending | accepted | declined | revoked
  created_at
  updated_at
  responded_at
```

## Sign-in lifecycle

1. User signs in with Google.
2. App reads `/users/{uid}`.
3. If `privateLedgerId` is missing, the app creates a generated private `/households/{householdId}` owned by that UID/email.
4. If `activeLedgerId` is missing, it is set to `privateLedgerId`.
5. The app loads household root metadata, subscribes to household events, and projects the event log into Redux.

## Invite lifecycle

1. Household owner enters a Google email.
2. App creates `/householdInvitations/{householdId}__{email}` with `status: pending`.
3. Invited user signs in with that exact Google email and sees the pending request.
4. Declining changes the invitation status; the invited user's private household remains active.
5. Accepting confirms that the active dashboard will switch to the shared household.
6. Accepting updates the household root access metadata, updates `/users/{uid}.activeLedgerId`, marks the invitation accepted, and records member/profile state through ledger events.

## Leave lifecycle

A non-owner member can leave a shared household. Leaving:

- sets `/users/{uid}.activeLedgerId` back to `/users/{uid}.privateLedgerId`
- removes the member email from `allowed_emails`
- removes the member UID from `member_uids`
- records member removal through ledger events

The owner's household remains active for remaining authorized members.

## Owner revocation lifecycle

Owners can revoke accepted member access by email. Revocation removes both access keys from the household root metadata:

- `allowed_emails`
- `member_uids`

The member removal is represented through ledger events. If a removed user later opens the app and Firestore denies their shared `activeLedgerId`, the client falls back to that user's private household.

## Event-sourced ledger behavior

Domain behavior is represented by immutable ledger events and deterministic projection:

- Transaction edits append adjustment/reversal/replacement events.
- Delete/revert actions append offsetting events.
- Direct top-up, envelope transfer, and reconciliation reversals append offsetting events.
- Salary arrival appends salary and allocation events.
- Reset appends a reset boundary event and projects a post-reset read model.
- The current dashboard is always the projection of the scoped event log.

## Event logs

- Authenticated cloud event logs are scoped by user UID and household ID.
- Local-only event logs are scoped to the local household.
- Duplicate events are ignored by event ID.
- Realtime Firestore event subscriptions append unseen remote events and project the read model.

## Security checklist

- Manual household IDs from URLs/local storage must not grant access.
- Firestore rules must check owner UID, member UID, or owner email against the household root document.
- Only generated cloud household IDs can be written to Firestore.
- Event documents under `/households/{householdId}/events/{eventId}` are immutable.
- Owner removal must revoke both `allowed_emails` and `member_uids`.
- Members can leave only themselves; owners cannot leave their owned household.
- Reset/rewind must remain owner-only for shared households.
