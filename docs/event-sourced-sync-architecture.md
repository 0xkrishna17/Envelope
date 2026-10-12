# Event-Sourced Sync Architecture

Envelope uses a cloud-first event-sourced architecture.

```text
Ledger state = deterministic projection of immutable Firestore event documents
```

## Core flow

```text
User action
  -> domain command validates intent
  -> command creates immutable LedgerEvent(s)
  -> cloud-first commit writes events to Firestore
  -> cloud runtime pulls/receives Firestore events
  -> projector derives LedgerState
  -> Redux displays projected LedgerState
```

Firestore acknowledgement is the success boundary. UI flows should close screens and show success feedback only after the cloud commit path returns success. If the commit fails, Redux keeps the last confirmed projection and the user sees an error.

## Invariants

1. Firestore event documents are the durable ledger source of truth.
2. Redux is a read model, not sync truth.
3. User-visible domain state changes only after events are accepted by Firestore and projected.
4. Firestore event documents are immutable.
5. Event IDs are unique and duplicate events are ignored by ID.
6. Recovery pulls remote events and projects the latest confirmed cloud log.
7. Reset is an event/projection boundary.
8. Startup should not show seed balances once a cloud event log has been loaded for the active household.
9. Derived balances read only from projected state.
10. App-owned browser storage is not part of the event runtime.

## Implementation modules

The event-sourced runtime lives under `src/sync/events/`:

- `types.ts` — event, scope, and projection seed types.
- `eventIds.ts` — session-only device/event sequence helpers; no persistent browser storage.
- `projectLedger.ts` — pure event-log-to-ledger projector.
- `commands.ts` — deterministic event builders for domain commands.
- `firestoreEvents.ts` — Firestore serialization/deserialization for event documents.
- `eventSyncEngine.ts` — isolated push/pull/subscribe primitives for `/households/{householdId}/events`.
- `runtime.ts` — projection helper for already-loaded event arrays.
- `cloudRuntime.ts` — cloud-first orchestration for Firestore commit, pull, and projection.

Manual sync, recovery sync, mutation commits, and realtime Firestore subscriptions all use this cloud event runtime.

## Removed local-first behavior

The app no longer has:

- a localStorage event store
- pending local mutation queues
- local event import into cloud
- local ledger caches
- app-owned localStorage profile/onboarding preferences
- PWA offline app-shell caching

Signed-in users must have authorized Firestore access and active connectivity to create durable ledger changes.
