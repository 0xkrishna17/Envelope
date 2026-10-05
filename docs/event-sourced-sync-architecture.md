# Event-Sourced Sync Architecture

Envelope sync uses a clean-slate event-sourced architecture.

```text
Ledger state = deterministic projection of an immutable event log
```

## Core flow

```text
User action
  -> domain command validates intent
  -> command creates immutable LedgerEvent(s)
  -> scoped local event store appends by stable id
  -> projector derives LedgerState
  -> Redux displays projected LedgerState
  -> sync pushes pending events to Firestore
  -> realtime event subscription appends unseen remote events
  -> projection runs again
```

Firestore acknowledgements for local events must not change the displayed ledger, because the event was already projected locally.

## Invariants

1. Redux is a read model, not sync truth.
2. User-visible domain state changes only by appending events and projecting them.
3. Firestore event documents are immutable.
4. Event IDs are stable and retry-safe.
5. Duplicate events are ignored by id.
6. Recovery pulls remote events before pushing pending local events.
7. Reset is an event/projection boundary.
8. Startup should not show seed balances if a scoped event log exists.
9. Derived balances read only from projected state.

## Implementation modules

The event-sourced runtime lives under `src/sync/events/`:

- `types.ts` — event, envelope, scope, and watermark types.
- `eventIds.ts` — stable device IDs and monotonic local event sequences.
- `eventStore.ts` — localStorage-backed event store with idempotent append and ack metadata.
- `projectLedger.ts` — pure event-log-to-ledger projector.
- `commands.ts` — deterministic event builders for domain commands.
- `firestoreEvents.ts` — Firestore serialization/deserialization for event documents.
- `eventSyncEngine.ts` — isolated push/pull/subscribe primitives for `/households/{householdId}/events`.
- `runtime.ts` — local event append + projection bridge.
- `cloudRuntime.ts` — dependency-injected cloud orchestration for pull-before-push, event push, ack, watermark update, and projection.

Manual sync, recovery sync, and realtime Firestore event subscription all use this event runtime.
