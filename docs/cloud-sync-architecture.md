# Cloud Sync Architecture

Envelope now uses a cloud-first event-sourced sync model. Firestore is the only durable ledger source for signed-in users; Redux is a projected UI read model.

## Canonical data

- Household root documents store identity and access metadata: owner UID, owner email, allowed emails, member UIDs, timestamps, first-time intro state, and schema version.
- Ledger state is derived from immutable event documents under `/households/{householdId}/events/{eventId}`.
- Redux is rebuilt from cloud events and must not be treated as the sync source of truth.
- App-owned browser storage is not part of the data model. The app does not maintain local event queues, local ledger caches, or local-to-cloud imports.

## Runtime flow

```text
User command
  -> domain command validates intent
  -> command creates immutable LedgerEvent(s)
  -> cloud mutation guard checks auth, access, bootstrap state, and connectivity
  -> Firestore event batch write
  -> pull latest Firestore events or receive subscription update
  -> deterministic projection into Redux
  -> UI reports success only after the cloud commit path succeeds
```

If Firestore write fails, the UI keeps the current projection unchanged and surfaces the failure. Offline devices cannot create durable ledger changes.

## Access model

- Firestore access is Google-authenticated.
- Household root metadata controls access through owner/member UID and allowed lowercase Google emails.
- Shared household links select a target household but never grant access by themselves.
- Authorized users may create immutable event documents for their household.
- Signed-out users cannot create real ledger changes.

## Legacy client cleanup

The app no longer registers a service worker or exposes PWA install flows. `src/main.tsx` keeps a best-effort cleanup path that unregisters previously installed service workers and deletes old offline caches when existing clients load the updated app.

## Clean setup

Firestore households should be created with root metadata and immutable event documents only. No local import collection, local queue, or browser-storage migration is required.
