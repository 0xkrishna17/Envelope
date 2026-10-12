# 💌 Envelope

A warm, family-friendly envelope-budgeting web app for planning monthly money, tracking spending, and syncing household budgets across devices.

## ✨ What it does

- 🧧 **Envelope budgeting** — allocate salary into categories and track remaining balances.
- 💸 **Transaction logging** — record spending with payment methods and category details.
- 🔁 **Move funds** — transfer money between envelopes when plans change.
- 💳 **Credit-card reconciliation** — track pending and reconciled card spending.
- 👨‍👩‍👧 **Household sharing** — manage trusted household access with Google sign-in and Firestore rules.
- ☁️ **Cloud-first sync** — save durable ledger changes through Firebase/Firestore for authorized Google accounts.
- 🎙️ **Voice intent parsing** — parse natural-language transactions with Gemini when configured, with a deterministic parser fallback.

## 🧰 Tech stack

- ⚛️ React 19 + TypeScript
- 🧭 Redux Toolkit + React Redux
- ⚡ Vite
- 🚂 Express
- 🔥 Firebase / Firestore
- 🧪 Vitest
- 🎨 Tailwind CSS v4 utilities
- 🐰 Bun for dependency management and scripts

## 🚀 Getting started

### 1. Install dependencies

```bash
bun install
```

### 2. Run locally

```bash
bun run dev
```

The Express server starts the app with Vite middleware. By default it runs on:

```text
http://localhost:3000
```

### 3. Build for production

```bash
bun run build
```

### 4. Start the production server

```bash
bun run start
```

## 🧪 Quality checks

Run the test suite:

```bash
bun run test
```

Run TypeScript checks:

```bash
bun run lint
```

## 🌐 Deployment

### Netlify app bundle

For Netlify frontend deployment:

```bash
bun run build:netlify
netlify deploy --prod --dir=dist --skip-functions-cache
```

Netlify Functions live in `netlify/functions/`, and API redirects are configured in `netlify.toml`.

### Firestore security rules

Netlify deploys do **not** publish Firestore security rules. Deploy `firestore.rules` separately whenever household access, invitations, sync permissions, or user-profile authorization rules change:

```bash
firebase deploy --only firestore:rules
```

Recommended production order:

1. Run local checks:
   ```bash
   bun run test
   bun run lint
   ```
2. Build and deploy the Netlify app bundle:
   ```bash
   bun run build:netlify
   netlify deploy --prod --dir=dist --skip-functions-cache
   ```
3. Deploy Firestore rules if `firestore.rules` changed:
   ```bash
   firebase deploy --only firestore:rules
   ```
4. Load the deployed app once in any browser that previously installed it so the app can unregister legacy service workers and clear stale offline caches.

## 🔐 Environment variables

Create a local `.env` file when needed. Do not commit real secrets.

Common variables:

- `GEMINI_API_KEY` — enables Gemini-powered voice parsing.
- `APP_URL` — hosted app URL used for callbacks and self-referential links.

Without `GEMINI_API_KEY`, voice parsing intentionally falls back to deterministic local rules.

## 🗂️ Project map

```text
src/App.tsx                 Main app shell and screen orchestration
src/components/             UI components, modals, settings, sync, and household screens
src/context/                Auth, API loading, and budget context providers
src/store/                  Redux store, ledger slice, and selectors
src/sync/                   Firestore event sync, household identity, and invitation helpers
src/utils/                  Budget, currency, validation, date, and ledger utilities
server.ts                   Express API and production/static server
server/intentParser.ts      Shared Gemini/local voice parser
netlify/functions/          Serverless API endpoints
public/                     Icons and static assets
docs/                       Architecture notes
```

## 📚 Architecture notes

- 🧮 Monetary amounts are stored as integer paise.
- 🧾 Firestore event logs are the durable source of truth; Redux is the projected UI read model.
- 🗑️ Domain records generally use soft deletion with `deleted_at`.
- ☁️ Ledger writes require Firebase Auth, authorized household access, and active Firestore connectivity.
- 🛡️ Household access is enforced through owner-managed lowercase email allowlists and Firestore security rules.

See also:

- [`docs/cloud-sync-architecture.md`](docs/cloud-sync-architecture.md)
- [`docs/household-architecture.md`](docs/household-architecture.md)
- [`docs/event-sourced-sync-architecture.md`](docs/event-sourced-sync-architecture.md)

## 🧡 Development notes

- Keep UI changes aligned with the warm envelope-budget aesthetic.
- Prefer existing domain utilities and selectors over duplicating calculations in components.
- Preserve local fallback behavior for voice parsing.
- Avoid exposing credentials, `.env` values, or private configuration in logs or commits.
