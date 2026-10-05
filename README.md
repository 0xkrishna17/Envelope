# 💌 Envelope

A warm, family-friendly envelope-budgeting web app for planning monthly money, tracking spending, and syncing household budgets across devices.

## ✨ What it does

- 🧧 **Envelope budgeting** — allocate salary into categories and track remaining balances.
- 💸 **Transaction logging** — record spending with payment methods and category details.
- 🔁 **Move funds** — transfer money between envelopes when plans change.
- 💳 **Credit-card reconciliation** — track pending and reconciled card spending.
- 👨‍👩‍👧 **Household sharing** — manage trusted household access with Google sign-in and Firestore rules.
- ☁️ **Cloud sync** — keep budgets synchronized through Firebase/Firestore.
- 🎙️ **Voice intent parsing** — parse natural-language transactions with Gemini when configured, with a local fallback.
- 📱 **PWA support** — install the app and use offline-friendly static assets.

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

## 🌐 Netlify build

For Netlify frontend deployment:

```bash
bun run build:netlify
```

Netlify Functions live in `netlify/functions/`, and API redirects are configured in `netlify.toml`.

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
src/store/                  Redux store, ledger slice, selectors, and sync middleware
src/sync/                   Firestore sync engine, mappers, queue, and local cache
src/utils/                  Budget, currency, validation, date, and ledger utilities
server.ts                   Express API and production/static server
server/intentParser.ts      Shared Gemini/local voice parser
netlify/functions/          Serverless API endpoints
public/                     Manifest, service worker, icons, and static assets
docs/                       Architecture notes
```

## 📚 Architecture notes

- 🧮 Monetary amounts are stored as integer paise.
- 🧾 Ledger state is the source of truth and lives in Redux.
- 🗑️ Domain records generally use soft deletion with `deleted_at`.
- ☁️ Cloud writes require Firebase Auth and explicit import of local data before syncing.
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
