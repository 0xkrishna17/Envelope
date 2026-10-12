# Plan: Remove Offline/LocalStorage Features and Move to Cloud-First Operation

## Background & Motivation

Envelope currently has a local-first architecture in two layers:

1. **User-facing offline/PWA support**: service worker app-shell caching, PWA install prompts, offline marketing copy, local import prompts, and sync status text that promises local queued changes.
2. **Implementation-level local persistence**: localStorage-backed event logs, event sequence/device IDs, legacy mutation queues, ledger caches, onboarding/profile flags, salary allocation preferences, and debug flags.

The requested direction is stricter than merely removing PWA/offline UX:

- Remove all **app-owned `localStorage` usage**.
- Remove signed-out/local ledger editing and local-to-cloud import.
- Remove PWA/offline caching/install UX.
- Keep Firebase SDK auth persistence as-is; do not force memory-only Firebase auth.
- Make signed-in, online Firestore the only durable source for ledger/profile/onboarding state.

## Scope & Impact

### In Scope

- Remove source references to `localStorage`, app-owned storage keys, and localStorage-backed stores/queues.
- Remove offline-first/PWA service worker behavior and install UI.
- Remove signed-out/local-only event log hydration and local event import flows.
- Convert active ledger mutations from local-first append/project/push to cloud-first Firestore writes.
- Disable or reject ledger mutations when the app is signed out, access-blocked, not cloud-backed, or browser-offline.
- Refactor sync display/copy away from “offline/local saved” semantics.
- Update or delete tests that assert offline/localStorage/PWA behavior.
- Update README/docs/TABNINE project instructions to reflect cloud-first behavior.

### Out of Scope

- Changing Firebase SDK internal auth persistence. Firebase may still use its own browser persistence.
- Introducing new dependencies.
- Reworking Firestore security rules unless the cloud-first write path exposes a rule mismatch during validation.
- Preserving unsynced device-only local ledger data. This plan treats that data as intentionally unsupported after cleanup.

### Breaking Behavioral Changes

- Signed-out users will no longer be able to create real ledger changes.
- Existing local-only/unsynced ledger events in app-owned localStorage will no longer be imported or read.
- Offline users will not be able to add/edit/delete transactions, allocations, categories, members, reconciliations, or settings that are represented as ledger events.
- Profile/onboarding completion will not be remembered locally. For signed-in users it must come from Firestore/auth profile state or ledger events.
- PWA install prompts and offline app-shell refresh behavior will be removed.

## Proposed Solution

### 1. Establish Cloud-First Write Primitives

Create a new cloud-first event write path under `src/sync/events/`, likely alongside or replacing pieces of the current runtime:

- Build ledger events in memory using cloud context.
- Push those events to Firestore first via `pushLedgerEvents` or a new lower-level batch helper.
- Pull/reload events from Firestore and project Redux only after the cloud write succeeds.
- If the write fails, do not project the change into Redux.
- Return a `SyncResult`/domain result that UI handlers can surface as an error.

Key design updates:

- Replace storage-based sequence/device ID generation in `eventIds.ts`.
  - Use non-persistent event IDs, e.g. `crypto.randomUUID()` per event.
  - Sequence can become a per-command timestamp/random tie-breaker or be removed from ordering if Firestore `server_revision` is authoritative.
  - If sequence remains required by types/projector ordering, generate it in memory from `Date.now()` plus a per-session counter in React state/module scope, not localStorage.
- Treat Firestore as the durable event store.
- Keep `projectLedger` as the deterministic read-model projector.

### 2. Refactor `BudgetContext` Active Data Flow

`src/context/BudgetContext.tsx` is the core file.

Remove local-first branches:

- `localEventScope`
- signed-out `hasStoredEvents/projectStoredEvents` hydration
- `hasLocalEventsToImport`
- `importLocalEventsToCloud`
- `dismissLocalEventImport`
- `createLocalStorageEventStore(localStorage)` usage
- local import decision key
- all `localStorage` reads/writes

Replace mutation flow:

- Introduce a guard such as `canMutateCloudLedger`:
  - user exists
  - verified cloud household exists
  - access allowed
  - not cloud bootstrap pending
  - `navigator.onLine !== false`
- Introduce a reusable `commitCloudLedgerEvents(events)` helper:
  1. Validate mutation guard.
  2. Set sync status/loading state to `syncing`.
  3. Push events to Firestore.
  4. Pull latest cloud events or rely on subscription callback, then project state.
  5. Set `lastCloudSync`/`synced` on success.
  6. Set `offline`/`error` and return failure on network/server errors.
- Update all event-producing handlers to use this helper instead of `appendLedgerEvents` / `appendEventAndProject`:
  - transactions add/update/delete/correction
  - salary and allocations
  - allocation transfer toggles
  - reconciliations
  - envelope transfers
  - category funds
  - category create/update/archive/unarchive/delete if present
  - member profile/update/delete
  - push notification settings
  - reset ledger
  - household access updates that currently append events after Firestore side effects

Important return-contract issue:

- Some handlers currently return created objects synchronously (`addTransaction`, `logCorrection`, salary result). Cloud-first writes are async.
- Update context types and UI callers to handle `Promise` results where necessary, or keep synchronous local object construction but only close/show success after the Promise resolves.
- This must be done explicitly and type-safely; no `any` or hidden casts.

### 3. Simplify Signed-Out and Offline UX

- Decide UI behavior for signed-out users as sign-in gate/read-only seed screen. Based on confirmed strategy, signed-out users cannot mutate real data.
- In forms/modals/buttons that call mutating context methods, surface disabled states or failure messages when:
  - not signed in
  - offline
  - cloud access denied
  - sync/bootstrap not ready
- Prefer centralizing the disabled reason in `BudgetContext` so components do not duplicate auth/network logic.
- Use `navigator.onLine` only as a preflight UX guard; still handle Firestore failures because `navigator.onLine` is not authoritative.

### 4. Remove PWA/Offline Install Surface

Files to modify/remove:

- `src/main.tsx`
  - Remove service worker registration/update/reload logic.
  - Add a one-time best-effort service worker unregister + cache cleanup routine to evict old installed offline workers for existing clients.
- `public/sw.js`
  - Delete file or replace temporarily with a cleanup worker depending deployment needs.
  - Recommended: keep a minimal cleanup worker for one release if existing clients may have `/sw.js` registered, then remove later.
- `public/manifest.json`
  - Remove/unlink from `index.html`, or keep only if desired as non-offline metadata. Since PWA install UX is being removed, unlink it.
- `index.html`
  - Remove manifest link and mobile web-app-capable install tags. Keep neutral theme/icon metadata if desired.
- `src/hooks/usePwaInstall.ts` and `src/hooks/usePwaInstall.test.ts`
  - Delete if no longer imported.
- `src/components/InstallAppModal.tsx`
  - Delete if no longer rendered.
- `src/components/FloatingNavMenu.tsx`
  - Remove `onOpenInstallModal` prop/action and “Offline” badge.
- `src/components/SettingsTab.tsx`
  - Remove PWA install props/section/copy.
- `src/App.tsx`
  - Remove PWA hook state, install modal state, props passed to Settings/FloatingNav, and modal rendering.

Notification note:

- `src/utils/browserNotifications.ts` currently tries service-worker notifications first, then window notifications.
- If service worker is removed, simplify to window `Notification` only and update tests.

### 5. Remove App-Owned LocalStorage Modules

Delete or heavily refactor:

- `src/sync/events/eventStore.ts`
  - Remove localStorage event store. If an in-memory event list is needed only for projection during a fetch, use plain arrays from Firestore pull results.
- `src/sync/events/runtime.ts`
  - Remove local append/project runtime.
- `src/sync/events/cloudRuntime.ts`
  - Replace with cloud-first fetch/project orchestration that does not store pending events locally.
- `src/sync/events/importLocalEvents.ts`
  - Delete local import feature.
- `src/sync/localCache.ts`
  - Delete legacy cache helpers.
- `src/sync/mutationQueue.ts`
  - Delete legacy queue helpers.
- `src/sync/mutationMapper.ts`
  - Delete if only used by legacy queue/middleware tests.
- `src/store/syncMiddleware.ts`
  - Delete if still unused by `store/index.ts`, or strip to only non-storage responsibilities if any remain.
- `src/utils/syncDebug.ts`
  - Remove `window.localStorage.getItem('env_budget_sync_debug')`; keep URL query `?syncDebug=1` if debug support should remain without storage.

Refactor:

- `src/sync/events/commands.ts`
  - Remove `storage` from command context.
  - Generate IDs without persistent device/sequence storage.
- `src/sync/events/types.ts`
  - Remove `LocalEventEnvelope`, `LocalEventSyncState`, `SyncWatermark`, and `{ kind: 'local' }` scope if no longer needed.
  - Consider whether `deviceId`, `sequence`, and `baseRemoteRevision` remain in `LedgerEvent`. If Firestore documents/tests still expect them, generate non-persistent values for compatibility first, then remove in a later schema migration if desired.

### 6. Remove LocalStorage from Profile/Onboarding/Form Preferences

- `src/App.tsx`
  - Remove `hasLocalIntroCompletion` and local profile prompt key logic.
  - Signed-in intro/profile completion should depend on Firestore profile flags and/or ledger `firstTimeIntroCompleted` only.
  - Signed-out flow should not persist completion locally.
- `src/components/ProfileModal.tsx`
  - Remove `env_budget_profile_completed*` and `env_budget_user_name` writes.
  - Ensure profile completion is stored through `markUserProfileCompleted()` / Firestore or a cloud ledger event.
  - Reset logic should not read custom user name from localStorage.
- `src/components/AppTourGuide.tsx`
  - Remove `env_budget_tour_completed` write for non-first-time tour preference. If users manually open tour, closing it just closes it for current session.
- `src/components/SalaryArrivalModal.tsx`
  - Remove saved salary percentage read/write. Initialize equal percentages each time or load from a future cloud setting if needed.
- `src/context/AuthContext.tsx`
  - Remove app-owned `AUTH_STATUS_KEY` localStorage writes/removes.
  - Keep Firebase Auth as-is.

### 7. Update Sync Status and Copy

- `src/store/types.ts`
  - Re-evaluate `SyncState = 'offline'`; it can remain as a transient status meaning “cloud unavailable”, but not “local saved”.
- `src/utils/syncDisplay.ts`
  - Replace copy:
    - “Working Offline (Local Storage Active)” → “Cloud Unavailable” or “Reconnect Required”.
    - “Changes are saved locally…” → “Changes were not saved. Reconnect and try again.”
    - “Local Ledger Only” → “Sign in Required” or remove if signed-out gate replaces it.
- `src/components/CloudSyncScreen.tsx`
  - Remove “Offline resilience” section and any queue/local storage claims.
  - Make manual sync copy cloud-refresh oriented.
- `src/components/CloudSyncModal.tsx`
  - Remove or update stale offline/cache language.
- `src/components/AccessDeniedGate.tsx`, `Header.tsx`, settings copy as needed.

### 8. Tests to Delete, Rewrite, or Add

Delete or rewrite tests that assert removed features:

- `src/offlineIntro.test.ts`
- `src/main.test.ts` service worker registration assertions
- `src/utils/serviceWorkerSource.test.ts`
- `src/hooks/usePwaInstall.test.ts`
- `src/store/syncMiddleware.test.ts` if middleware deleted
- `src/sync/localCache.test.ts`
- `src/sync/mutationQueue.test.ts`
- `src/sync/mutationMapper.test.ts` if mapper deleted
- `src/sync/events/eventStore.test.ts`
- `src/sync/events/runtime.test.ts`
- `src/sync/events/cloudRuntime.test.ts` rewrite for cloud-first runtime
- `src/sync/events/importLocalEvents.test.ts`
- `src/sync/syncState.test.ts` rewrite if offline semantics change
- `src/utils/syncDisplay.test.ts` update copy assertions
- `src/utils/browserNotifications.test.ts` update if service-worker notification path removed

Add focused tests for the new behavior:

1. **No app-owned localStorage source guard**
   - Source-level test that scans `src/**/*.{ts,tsx}` and fails on `localStorage`, `sessionStorage`, or `env_budget_` keys except allowed Firebase internals are not in source.
2. **Cloud-first mutation test**
   - Mock Firestore push failure and assert the ledger projection is not updated.
   - Mock push success and pull/project success and assert ledger updates only after success.
3. **Offline mutation guard test**
   - Simulate `navigator.onLine === false`; assert mutating handler returns a network failure and does not update Redux.
4. **PWA cleanup test**
   - Assert `src/main.tsx` unregisters existing service workers / clears caches and does not register `/sw.js`.
5. **Signed-out mutation test**
   - Assert mutating APIs return signed-out failure or UI disables actions.
6. **Copy tests**
   - Assert sync display no longer contains “saved locally”, “offline resilience”, “local storage active”, or PWA install copy.

### 9. Documentation and Project Instructions

Update:

- `README.md`
  - Remove PWA/offline support claim.
  - Update `src/sync` description away from queue/local cache.
  - Remove service worker hard-refresh guidance if cleanup worker handles it.
- `docs/event-sourced-sync-architecture.md`
  - Rewrite as cloud-first event-sourced sync.
  - Firestore event log is canonical; Redux is projection; no local event journal.
- `docs/cloud-sync-architecture.md`
  - Update runtime flow: command → Firestore write → pull/subscription → projection.
- `docs/household-architecture.md`
  - Remove local-only event logs/import language.
- `TABNINE.md`
  - Remove project guidance saying to preserve PWA/offline flows.
  - Update architecture notes that signed-out users cannot create durable ledger data and Firestore is canonical.

## Alternatives Considered

### Alternative A: Pragmatic Cleanup Only

Remove PWA/offline UX and legacy queues, but keep localStorage event journal as implementation detail.

- Pros: Smaller, lower risk, preserves current responsiveness and signed-out use.
- Cons: Does not satisfy “remove localStorage fully” or true cloud-first requirement.

### Alternative B: Keep LocalStorage for Preferences Only

Remove ledger queues/event logs but keep profile/onboarding/salary preferences locally.

- Pros: Better UX; fewer Firestore reads/writes for small preferences.
- Cons: User explicitly rejected this by asking to remove localStorage fully.

### Alternative C: Force Firebase Auth Memory Persistence

Remove app-owned and Firebase-owned browser persistence.

- Pros: Strictest browser-storage posture.
- Cons: User rejected this; Firebase auth persistence should remain as-is.

## Implementation Phases

### Phase 1: Safety Nets and Baseline Tests

- Add failing guard tests for app-owned localStorage removal and offline/PWA copy removal.
- Add cloud-first mutation behavior tests around the new intended contract.
- Run current tests to capture baseline failures expected from the new tests.

### Phase 2: Remove PWA/Offline Shell

- Remove service worker registration and install UI wiring.
- Add service worker unregister/cache cleanup in `main.tsx`.
- Remove PWA install hook/modal/tests and manifest linkage.
- Simplify browser notifications away from service worker dependency.

### Phase 3: Remove LocalStorage Preferences and Onboarding State

- Remove app-owned auth status marker.
- Remove local profile/intro/tour/salary percentage persistence.
- Route profile/intro completion through Firestore/cloud-only state.
- Update related components/tests.

### Phase 4: Replace Local-First Event Runtime

- Refactor event ID generation to avoid persistent storage.
- Remove local event scope and local event import.
- Replace append/project helpers with cloud-first commit/fetch/project helpers.
- Update `BudgetContext` handlers to async cloud-first mutation APIs.
- Update callers/components to await results and show errors instead of assuming local success.

### Phase 5: Delete Legacy Storage/Queue Code

- Delete unused legacy sync middleware/cache/queue/mappers and tests.
- Delete localStorage event store/runtime/import modules once no imports remain.
- Prune types for local envelopes/watermarks/local scopes.

### Phase 6: Copy, Docs, and Final Verification

- Update sync display and cloud sync UI copy.
- Update README/docs/TABNINE.md.
- Run full validation.

## Verification & Testing

Minimum required commands after implementation:

```bash
npm run test
npm run lint
npm run build
```

Additional concrete verification:

1. **Source scan**
   - Run a repository search to confirm no app source references to:
     - `localStorage`
     - `sessionStorage`
     - app-owned `env_budget_` storage keys
     - `createLocalStorageEventStore`
     - `mutationQueue`
     - `localCache`
2. **Offline manual check**
   - Start app.
   - Sign in with a cloud-backed household.
   - Disable network.
   - Try a mutation.
   - Observe: action is disabled or returns an error; balances do not change; no “saved locally” message appears.
3. **Online manual check**
   - Re-enable network.
   - Perform transaction/category/salary mutation.
   - Observe: Firestore write succeeds; app projects updated cloud event state.
4. **Refresh check**
   - Refresh after successful cloud write.
   - Observe: state reloads from Firestore, not localStorage.
5. **Service worker cleanup check**
   - In a browser with existing old service worker, load app.
   - Observe old service worker is unregistered and caches are deleted.
6. **Signed-out check**
   - Sign out and attempt ledger mutation.
   - Observe sign-in gate or disabled mutation; no local draft data is created.

## Migration & Rollback

### Migration

- No migration for local-only unsynced ledger data. This is a breaking product decision.
- Existing Firestore cloud event data remains canonical and should be unaffected.
- Existing app-owned localStorage keys may remain in the browser but must no longer be read or written by app code.
- Optional cleanup: service worker/cache cleanup can also remove stale caches. Avoid blanket localStorage clearing if the goal is merely to stop app-owned usage, because Firebase Auth may use browser persistence internally under its own keys.

### Rollback

- Rollback path is source-control revert of the cloud-first rewrite.
- Because this plan removes local import and no longer reads local event logs, users with only local unsynced data would need the old version to access/import that data.
- Do not deploy partial phases that remove local event reads before cloud-first writes are working.

## Key Risks

- Large async API surface change in `BudgetContext`; many UI components may assume synchronous mutation success.
- Firestore write/project latency may make the app feel slower unless loading feedback is consistent.
- Event ordering/schema assumptions currently rely on local device IDs/sequences; removing persistent sequence requires careful tests.
- Service worker removal for already-installed clients needs explicit cleanup or old offline behavior can linger.
- Removing app-owned localStorage does not mean the browser has no storage usage because Firebase Auth persistence remains allowed by user decision.
