# Cloud Sync Architecture

Envelope uses a clean-slate event-sourced cloud sync model.

## Canonical data

- Household root documents store only identity/access metadata such as owner UID, owner email, allowed emails, member UIDs, timestamps, and schema version.
- Ledger state is derived from immutable event documents under `/households/{householdId}/events/{eventId}`.
- Redux is a projected read model and must not be treated as the sync source of truth.
- No other household child collections are part of the cloud sync model.

## Runtime flow

```text
User command
  -> LedgerEvent command builder
  -> scoped local event store append
  -> deterministic projection into Redux
  -> cloud event push/pull
  -> realtime Firestore event subscription appends remote events
  -> deterministic projection into Redux
```

## Access model

- Firestore access is Google-authenticated.
- Household root metadata controls access through owner/member UID and allowed lowercase Google emails.
- Shared household links select a target household but never grant access by themselves.
- Authorized users may create immutable event documents for their household.

## Clean setup

Firestore households should be created with root metadata and immutable event documents only.
