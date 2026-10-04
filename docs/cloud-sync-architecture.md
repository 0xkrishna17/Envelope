# Cloud Sync Architecture

This document describes Envelope's simplified Google sign-in, private ledger, household request, local cache, and Firestore security model.

## Security invariants

- A local-only ledger is not a cloud household.
- Reserved local/demo IDs must never be written to Firestore.
- Every cloud ledger uses a generated, unguessable internal ID.
- Ledger IDs are never exposed in URLs or share links.
- URL parameters and localStorage are never authoritative for cloud ledger selection.
- The authoritative active cloud ledger is `/users/{uid}.activeLedgerId`.
- Every signed-in user has a private ledger at `/users/{uid}.privateLedgerId`.
- Joining another household happens only through an email-addressed request that the recipient accepts.
- Normal ledger sync never changes household ownership fields.
- Firestore rules are the authoritative security boundary.

## Identity model

### Local-only ledger

`local` is the client-only sentinel for a signed-out/local ledger. It can be used in Redux and local cache, but it must never be used as `/households/{householdId}` in Firestore.

### Private cloud ledger

On first Google sign-in, the app creates a generated cloud ledger for that user and saves it in:

```text
/users/{uid}.privateLedgerId
/users/{uid}.activeLedgerId
```

### Shared household ledger

When a user accepts a household request, the app switches only `activeLedgerId` to the shared household. The user's private ledger remains available as the fallback for leaving the household.

## User lifecycle

### Signed out

The app runs in local-only mode and reads/writes `env_budget_cache_v4_local`. No Firestore reads or writes are attempted.

### New signed-in user

The app creates a private cloud ledger automatically. There is no manual first-time cloud setup and no default shared cloud ID.

### Returning signed-in user

The app reads `/users/{uid}.activeLedgerId`, verifies access through Firestore rules, then loads scoped cache and subscribes to realtime Firestore updates.

### Household request

The owner enters a recipient's Google email. The app creates `/householdInvitations/{householdId}__{inviteeEmail}`. The recipient sees this request after signing in with the matching Google email and can accept or decline it. No URL or household ID is shared.

### Leaving a household

A non-owner can leave a shared household. The app removes that user from household access and switches `/users/{uid}.activeLedgerId` back to `/users/{uid}.privateLedgerId`. Owners cannot leave an owned household in this version.

### Account switch or sign out

The app stops existing subscriptions, resets in-memory ledger state, and hydrates only the next account/scope's cache. Previous cloud data must not remain visible to another user.

## Firestore model

Household root:

```text
/households/{householdId}
```

Root authority fields:

- `owner_uid`
- `owner_email`
- `created_by`
- `allowed_emails`
- `member_uids`

`allowed_emails` records accepted Google emails. `member_uids` records accepted Firebase auth users. Normal sync preserves these fields. Owner-only access-management flows may create requests or remove access.

Invitation requests:

```text
/householdInvitations/{householdId}__{inviteeEmail}
```

Only the household owner can create/revoke a request. Only the matching invitee email can read and accept/decline the request.

## Cache model

Local cache key:

```text
env_budget_cache_v4_local
```

Cloud cache key:

```text
env_budget_cache_v4_user_{uid}_household_{householdId}
```

Cache is an optimization only. It never grants cloud access or selects an active cloud ledger.

## Firestore rules expectations

Rules enforce:

- signed-in access for cloud households
- reserved ID rejection for `local` and `hh_family_ledger_main`
- owner identity on household create
- immutable ownership fields after create
- authorized household reads/writes by owner/member only
- invitation create/revoke by household owner only
- invitation accept/decline by invitee email only
- profile ledger IDs must point only to authorized ledgers
- subcollection path consistency where documents include `household_id`

## Dev reset guidance

Because this app is currently in development, reset legacy shared data instead of migrating it:

```text
Delete /households/hh_family_ledger_main
Delete /users/*
Delete /householdInvitations/*
```

After reset, each Google account receives a private ledger automatically on sign-in. Owners can add other users by email request from Members or Cloud Sync.
