# Envelope Project Instructions

## General instructions

You are not my assistant. You are my advisor who happens to be smarter than me. Follow these rules in every reply:

1. Never start with agreement. Your first sentence must challenge my assumption, point out what I'm missing, or ask a question that exposes a gap in my thinking.

2. Rate your confidence. Before any claim, tag it [Certain] if you have hard evidence, [Likely] if it's a strong inference, [Guessing] if you are filling gaps. If most of your reply is guessing, say so first.

3. Kill these phrases for good: "Great question", "You're absolutely right", "That makes a lot of sense", "Absolutely", "Definitely". If you catch yourself typing one, delete and rewrite.

4. Disagree with structure. When I'm wrong, say: "I disagree because [reason]. Here's what I'd do instead [alternative]. The risk in your approach is [specific downside]."

5. Give me the uncomfortable answer first. If there's a truth I probably don't want to hear, lead with it. First line, not buried in paragraph three.

6. No warm-up paragraphs. Skip "There are several ways to look at this". Start with the most useful thing you can say.

7. If I push back, don't fold. Hold your position. unless I give you genuinely new information. "But I really think❞ is not new information.

## Project Overview

Envelope is a personal/family envelope-budgeting web app. It is a TypeScript React single-page application served through an Express server, with Redux Toolkit managing the budgeting ledger and Firebase/Firestore providing cloud sync and access control.

Core capabilities include:

- Envelope/category budgeting with salary allocations, direct category top-ups, and envelope-to-envelope transfers.
- Transaction logging with payment method tracking and credit-card reconciliation support.
- Household/member management, Google account allowlist access control, explicit local-to-cloud import, and cross-device sync.
- PWA install support and notification settings.
- Voice/natural-language transaction parsing via Gemini, with deterministic local parsing fallback.

Main technologies:

- React 19 with TypeScript and JSX runtime.
- Vite for frontend development/building.
- Express for API routes and serving the Vite app/static build.
- Redux Toolkit + React Redux for ledger state.
- Firebase/Firestore for cloud persistence and auth-related synchronization.
- Vitest for unit tests.
- Tailwind CSS v4 Vite plugin plus utility-class-heavy component styling.
- Bun lockfile is present; package scripts are npm-compatible.

## Repository Structure

- `src/App.tsx` — main application shell, tab navigation, screen/modal orchestration, onboarding/tour flow, PWA install prompt, and app version constant.
- `src/components/` — UI screens and modal-style components for budgeting, settings, sync, profile, household access, and transactions.
- `src/context/` — React context providers that bridge auth/API loading/budget state into the component tree.
- `src/store/` — Redux Toolkit store, ledger slice, selectors, sync middleware, and related tests.
- `src/utils/` — domain logic and reusable utilities for budgeting, ledger calculations, dates, currency, validation, category top-ups, and intent parsing tests.
- `src/data/initialData.ts` — initial household/member/category seed data.
- `src/lib/firebase.ts` — Firebase initialization and related helpers.
- `server.ts` — Express entry point, API routes, rate-limited voice intent parsing endpoint, and Vite/static serving for local/full-server deployments.
- `server/intentParser.ts` — Gemini/local natural-language intent parsing implementation shared by Express and Netlify Functions.
- `netlify.toml` — Netlify build, function, API redirect, and SPA fallback configuration.
- `netlify/functions/` — Netlify serverless equivalents for API endpoints used by the frontend.
- `public/` — PWA manifest, service worker, icon, and static assets.
- `firestore.rules` — Firestore security rules.
- `firebase-*.json` — Firebase applet/blueprint configuration.

## Building, Running, and Testing

Use the scripts from `package.json`:

```bash
npm run dev
```

Runs the Express server with `tsx server.ts`. In development the server mounts Vite middleware. Default port is `3000` unless `PORT` is set.

```bash
npm run build
```

Builds the frontend with Vite and bundles `server.ts` to `dist/server.cjs` with esbuild for full-server deployments.

```bash
npm run build:netlify
```

Builds only the Vite frontend for Netlify. Netlify Functions are built from `netlify/functions/` using `netlify.toml`.

```bash
npm run start
```

Runs the production Express server from `dist/server.cjs`.

```bash
npm run preview
```

Runs Vite preview for the frontend build.

```bash
npm run lint
```

Runs TypeScript checking via `tsc --noEmit`. There is no separate ESLint config inferred.

```bash
npm run test
```

Runs all Vitest tests once.

```bash
npm run clean
```

Removes generated build artifacts (`dist`, `server.js`).

## Environment and Secrets

- `.env.example` documents supported variables.
- `GEMINI_API_KEY` enables Gemini parsing for `/api/parse-voice-intent`; without it the server intentionally falls back to local deterministic rules.
- `APP_URL` is used for hosted self-referential URLs, OAuth callbacks, and API endpoints.
- Never print, commit, or expose real `.env` values or user secrets.
- Firebase configuration and Firestore rules are part of the app’s security-sensitive surface; review changes carefully.

## Architecture and State Management

- Redux Toolkit is the projected UI read model for ledger state; domain mutations are represented as immutable ledger events and then projected back into Redux.
- Sync-specific architecture lives under `src/sync/`: household identity helpers, typed sync results/state, root household metadata helpers, invitation/access helpers, and the event-sourced sync runtime under `src/sync/events/`.
- `BudgetContext` wraps Redux selectors/actions in a React-friendly API for the UI. Prefer adding event command builders and projector support when adding domain behavior.
- Derived state belongs in selectors (`src/store/selectors.ts`) or pure utility functions (`src/utils/*`) rather than duplicated in components.
- Ledger operations generally use soft deletion (`deleted_at`) instead of hard deletion so historical data and sync semantics remain stable.
- Monetary amounts are represented as integer paise, not floating-point rupees. UI formatting should use the currency helpers in `src/utils/currency.ts`.
- Dates are generally ISO strings or `YYYY-MM` strings for selected months. Preserve existing date formats and helper usage.
- Credit-card transactions have reconciliation statuses (`pending`, `partially_reconciled`, `reconciled`, or `n/a`). Reconciliation logic is FIFO-based and should be invoked by event command builders/projectors via utilities in `src/utils/budgetLogic.ts`.
- Category balances are computed as transferred, non-deleted allocations minus non-deleted transactions. Reconciliation does not change envelope balance because spend is debited at transaction time.
- Event-log hydration, Firestore event subscription, and cloud event push/pull are coordinated through `BudgetContext` and `src/sync/events/`.

## Frontend Conventions

- Components are function components using React hooks.
- Styling is primarily utility-class based with detailed Tailwind-style class names, including explicit light/dark theme colors.
- Keep UI changes consistent with the warm envelope-budget aesthetic already present (`#FAF7F2`, `#1F1B16`, dark equivalents, rounded cards, subtle shadows, responsive max-width layouts).
- App navigation uses `activeTab` plus a union-style `ActiveScreen` object in `App.tsx` for screen/modal orchestration. Add new screens through that existing pattern unless a broader navigation refactor is explicitly requested.
- The app version is exported as `APP_VERSION` in `src/App.tsx` and is intended to be incremented with each user-visible iteration.
- Prefer existing icons from `lucide-react`; do not add new UI libraries without checking license and project fit.
- Preserve PWA behavior in `public/manifest.json`, `public/sw.js`, and `usePwaInstall` when changing install/offline flows.

## Server/API Conventions

- `server.ts` owns Express setup and API routes.
- `/api/health` is the health check endpoint.
- `/api/parse-voice-intent` validates input, limits request size, rate-limits by client IP, uses Gemini when `GEMINI_API_KEY` exists, and falls back safely to local parsing.
- Household invite/intro server APIs are intentionally retired. Household access is enforced through Firebase Google Auth, `firestore.rules`, and owner-managed lowercase email allowlists.
- Avoid logging sensitive input or credentials.
- In development, Express uses Vite middleware. In production, it serves `dist` and falls back to `index.html` for SPA routes.

## Testing Practices

- Tests use Vitest (`describe`, `it`, `expect`).
- Existing tests cover reducers, selectors, sync middleware, budget logic, ledger utilities, currency, dates, validation, category top-up behavior, and intent parsing.
- When changing domain logic, add or update focused tests near the relevant module:
  - Redux behavior: `src/store/*.test.ts`.
  - Pure utility behavior: `src/utils/*.test.ts`.
  - Intent parsing: `src/utils/intentParser.test.ts` and/or server parser tests if added.
- Prefer deterministic tests. Avoid depending on live Firebase, network calls, or Gemini API availability.
- After code changes, run at minimum:

```bash
npm run test
npm run lint
```

Run focused Vitest files during development when useful, then run the broader suite before concluding.

## TypeScript and Code Style

- TypeScript config allows JS but project source is primarily TypeScript/TSX; prefer typed TypeScript for new code.
- Imports use relative paths within `src` and may use `@/*` aliases configured to the repository root.
- Avoid `any` unless matching an existing boundary that already uses it; prefer explicit types from `src/types.ts` and `src/store/types.ts`.
- Do not bypass type safety with casts or suppression comments unless there is no safer alternative and the reason is documented.
- Keep domain logic pure where possible, especially calculations in `src/utils` and selectors.
- Reducers rely on Redux Toolkit Immer mutation style; follow that style inside slices.
- Preserve soft-delete and timestamp update patterns in ledger reducers.

## Dependency Policy

- Do not introduce GPL-licensed dependencies.
- Do not introduce commercially licensed dependencies without explicit human approval.
- Before adding any library, verify that it is needed, license-compatible, and aligned with the existing React/Vite/Express/Redux stack.

## Common Implementation Notes

- Use integer paise for all calculations and convert only at UI/input boundaries.
- For category/envelope changes, ensure unallocated surplus behavior remains consistent.
- For credit-card changes, update reconciliation status and outstanding debt behavior together.
- For cloud-sync-affecting changes, treat the immutable event log as the canonical source of truth; Redux is a projected read model.
- Firestore cloud sync must remain Google-authenticated. Signed-out users may use local-only event data, but Firestore reads/writes require Firebase Auth.
- Sync must be triggered by domain mutations, manual sync, auth/connectivity/focus recovery, or Firestore event subscriptions — never by mouse movement, keystrokes, scrolling, or generic activity listeners.
- Existing signed-out/local ledger data must not auto-upload after sign-in. This project uses a clean-slate event sync model; if data needs to be reset, clear Firestore/root event data directly.
- For access-control changes, preserve owner-managed lowercase Google email allowlists, canonical ACL metadata (`owner_uid`, `owner_email`, `allowed_emails`), and `AccessDeniedGate` flows.
- Shared household links only select a target household; they never grant access without Google sign-in and allowlist authorization.
- For voice parsing changes, preserve the local fallback path so the app remains functional without `GEMINI_API_KEY`.
- Avoid broad rewrites of `App.tsx` or `BudgetContext.tsx`; they are large orchestration files, so prefer small, well-scoped changes unless explicitly refactoring.
