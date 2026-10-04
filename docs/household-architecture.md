# Household Architecture

Envelope uses Google Auth plus Firestore to keep each user's private ledger isolated while allowing explicit household sharing.

## Core invariants

- Every signed-in Google user has a private cloud ledger created automatically on first sign-in.
- The active dashboard is selected from `/users/{uid}.activeLedgerId`; users do not choose ledger IDs from URLs or share links.
- Household IDs are internal generated IDs and must never be exposed as join links.
- Firestore rules are the security boundary. Client-side checks improve UX, but rules must reject reads/writes for unauthorized users even if someone tampers with local storage, URLs, or requests.
- Reserved/local IDs such as `local` and `hh_family_ledger_main` are rejected for cloud access.

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

/households/{householdId}/members/{memberId}
/households/{householdId}/categories/{categoryId}
/households/{householdId}/salaryEvents/{salaryEventId}
/households/{householdId}/allocations/{allocationId}
/households/{householdId}/transactions/{transactionId}
/households/{householdId}/reconciliations/{reconciliationId}
/households/{householdId}/reconciliationLines/{lineId}
/households/{householdId}/envelopeTransfers/{transferId}

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

Only the listed household subcollections are valid ledger data collections.

## Sign-in lifecycle

1. User signs in with Google.
2. App reads `/users/{uid}`.
3. If `privateLedgerId` is missing, the app creates a generated private `/households/{householdId}` owned by that UID/email.
4. If `activeLedgerId` is missing, it is set to `privateLedgerId`.
5. Redux hydrates only from the cache scoped by `uid + activeLedgerId`, then Firestore becomes authoritative.

## Invite lifecycle

1. Household owner enters a Google email.
2. App creates `/householdInvitations/{householdId}__{email}` with `status: pending`.
3. No join link is generated.
4. Invited user signs in with that exact Google email and sees the pending request.
5. Declining changes only the invitation status; the invited user's private ledger remains active.
6. Accepting requires an explicit warning because the active dashboard switches to the shared household.
7. Accept writes one batch:
   - add invitee email to `allowed_emails`
   - add invitee UID to `member_uids`
   - create/update `members/mem_{uid}`
   - set `/users/{uid}.activeLedgerId` to the shared household
   - mark invitation `accepted`

The invited user's private ledger remains stored in `/users/{uid}.privateLedgerId`.

## Leave lifecycle

A non-owner member can leave a shared household. Leaving writes one atomic batch:

- set `/users/{uid}.activeLedgerId` back to `/users/{uid}.privateLedgerId`
- remove the member email from `allowed_emails`
- remove the member UID from `member_uids`
- soft-delete `members/mem_{uid}` with `deleted_at`

After leaving, the user's private ledger becomes active again.

## Owner revocation lifecycle

Owners can revoke accepted member access by email. Revocation removes both access keys:

- remove email from `allowed_emails`
- remove UID from `member_uids`
- soft-delete the member document

The owner cannot safely write another user's `/users/{uid}` profile under Firestore rules. Instead, if the removed user later opens the app and Firestore denies their old shared `activeLedgerId`, the client falls back to their own `privateLedgerId`.

## Append-only ledger transactions

Transaction edits are stored as new ledger rows instead of mutating the original row.

- Every transaction row has a unique `id`/TID and is stored as `/households/{householdId}/transactions/{transactionId}` in Firestore.
- Amount-only edits create an `adjustment` transaction with its own TID and `related_transaction_id` pointing to the original TID.
- Category or payment-method edits create a `reversal` row for the original bucket and a `replacement` row for the new bucket.
- Delete/revert actions create reversal rows instead of removing or soft-deleting the original row.
- Direct top-up, envelope transfer, and reconciliation reverts also append offsetting entries rather than deleting history.
- The original transaction row remains unchanged for audit history.
- Ledger display is reverse chronological by transaction date, exact creation timestamp, then ID for deterministic ordering.
- Credit-card pending debt folds `adjustment` and `reversal` rows into the related original transaction so reconciliation remains correct.
- Replaying ledger entries in chronological order should reconstruct balances at each point in time.

## Reset lifecycle

Reset is owner-only for shared cloud households. Local/private owners can reset their own ledger.

Reset behavior:

- clears transactional data in Redux
- keeps household owner/access metadata
- writes the full current ledger snapshot to Firestore
- deletes stale documents from known subcollections before writing current docs, so old transactions/allocations cannot reappear after reset

Future rewind should build on this by writing owner-only snapshots before destructive actions and restoring from a selected snapshot with an explicit warning. The warning must say that restoring to a past point replaces the active ledger with that snapshot and loses all later ledger history from the active timeline.

## Cache and pending mutations

Authenticated cloud cache and pending mutation queues are scoped by both user UID and household ID. This prevents shared browsers or account switching from replaying stale data or queued writes across users.

Anonymous/local-only data remains in the local ledger cache.

## Security checklist

- Manual household IDs from URLs/local storage must not grant access.
- Firestore rules must check owner UID, member UID, or owner email against the household root document.
- Only generated cloud household IDs can be written to Firestore.
- Rules must restrict subcollection access to the known ledger collections.
- Owner removal must revoke both `allowed_emails` and `member_uids`.
- Members can leave only themselves; owners cannot leave their owned household.
- Reset/rewind must remain owner-only for shared households.
