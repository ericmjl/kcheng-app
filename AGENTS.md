# AGENTS.md

Guidance for AI coding agents working on **China Trip Planner** (kcheng-app): a PWA for trip calendar, contacts, meeting dossiers, company trends, todos, trains, and Didi.

---

## Commands (run these)

- **Install deps:** `npm install`
- **Dev server:** `npm run dev` → <http://localhost:3000>
- **Production build:** `npm run build`
- **Run production locally:** `npm run start`
- **Lint:** `npm run lint` (ESLint; fix errors before committing)
- **Convex (backend):** `npx convex dev` for local Convex dev; `npx convex dev --once --typecheck=disable` to push schema/functions without blocking on typecheck. Schema and function changes require a push so the deployed backend accepts them.

Always run `npm run build` (or at least `npx tsc --noEmit`) before committing to catch TypeScript errors; the project uses strict mode.

---

## Tech stack (be specific)

- **Next.js 16** (App Router), **React 19**, **TypeScript** (strict)
- **Convex** – backend DB and serverless functions (contacts, events, todos, dossiers, userSettings, etc.). Data lives in Convex; the app uses `getConvexClient(uid)` and `api.*` from `@/lib/convex-server` in API routes.
- **WorkOS Auth Kit** – auth (sign-in, callback). User id is the WorkOS user id; Convex auth is wired in `convex/auth.config.ts` and `src/lib/convex-auth.ts`.
- **Tailwind CSS 4** – styling. Use CSS variables for theme (e.g. `var(--text)`, `var(--mint-soft)`, `var(--coral)`).
- **AI:** OpenAI (chat, conversation starters, summaries, Whisper), Vercel AI SDK (`@ai-sdk/react`, `ai`). Chat transport hits `/api/chat`; tools include `findContactsByName`, `createContact`, `createEvent`, `createTodo`.
- **PWA:** manifest, service worker, IndexedDB caching for calendar/contacts/todos when offline.

Do not assume Firebase; the app uses Convex + WorkOS. The README may still mention Firebase from an older setup.

---

## Project structure

- **`src/app/`** – Next.js App Router: `page.tsx` routes, `layout.tsx`, `api/` route handlers. Key pages: `contacts/`, `calendar/`, `events/[id]/`, `todos/`, `trains/`, `dossiers/`, `settings/`.
- **`src/app/api/`** – API routes. All authenticated via `getUid(request)` from `@/lib/workos-auth`; use `getConvexClient(uid)` for Convex. Never expose Convex directly to the client for mutations from unauthenticated code.
- **`src/app/components/`** – Shared UI (e.g. `TripAssistantPanel`, `WhatsNext`, `Nav`).
- **`src/lib/`** – Shared utilities: `types.ts` (Contact, Event, Todo, etc.), `convex-server.ts`, `workos-auth.ts`, `cachedFetch.ts`, `exa.ts`, `parse-document.ts`, `generate-display-summary.ts`.
- **`convex/`** – Convex backend: `schema.ts` (single source of truth for tables), `contacts.ts`, `events.ts`, `todos.ts`, `dossiers.ts`, `userSettings.ts`, `plannedRoutes.ts`, `pushSubscriptions.ts`, `lib/auth.ts`. Do not edit `convex/_generated/`; it is generated.
- **`scripts/`** – One-off scripts (e.g. `jwks-data-uri.cjs`).
- **`.env.local`** – Local env (never commit). Required/optional vars are documented in README and used in API routes (e.g. OpenAI, WorkOS, Convex, EXA).

---

## Code style and conventions

- **TypeScript:** Strict mode. Prefer explicit types for API/Convex boundaries; use `unknown` for untrusted input before narrowing.
- **React:** Functional components, hooks. Use `"use client"` only where needed (client state, events, browser APIs).
- **Data flow:** Server: Convex via `getConvexClient(uid)` in API routes. Client: fetch `/api/*` with `credentials: "include"`. For realtime or client Convex, use the Convex React provider and `api.*` from `convex/_generated/api`.
- **Ids:** Convex document ids are used as opaque strings in the app (e.g. `contact.id`, `event.id`). When calling Convex from API routes, pass `id` as `DocId<"contacts">` etc. (from `_generated/dataModel`).
- **Events/contacts/todos:** Events and todos support multiple contacts via `contactIds: string[]`. Use `getEventContactIds(event)` from `@/lib/types` for backward compatibility with legacy `contactId`.
- **Naming:** camelCase for functions/variables, PascalCase for components and types. Files: `kebab-case` or `PascalCase` for components.

Example of consistent style:

```ts
// API route: auth, then Convex
const uid = await getUid(request);
if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const client = await getConvexClient(uid);
const doc = await client.query(api.contacts.get, { id: id as DocId<"contacts"> });
```

---

## Testing and validation

- **TypeScript:** Run `npx tsc --noEmit` to verify types. Fix any errors before committing; Vercel build runs this.
- **Lint:** Run `npm run lint`. Fix reported issues.
- No Jest/Vitest/Playwright in this repo; rely on typecheck and lint plus manual verification.

---

## Git and deployment

- **Branch:** Work on `main` or a feature branch; default branch is `main`.
- **Before commit:** Run `npm run build` (or `npx tsc --noEmit`) and `npm run lint`. Resolve TypeScript and ESLint errors.
- **Convex:** After changing `convex/schema.ts` or any `convex/*.ts` function, run `npx convex dev --once` (or keep `npx convex dev` running) so the deployed backend is updated.
- **Vercel:** Pushes to `main` trigger production deploys. Env vars must be set in Vercel (and in WorkOS dashboard for auth) for production.

---

## Boundaries

- **Always do:** Use existing patterns (e.g. `getUid`, `getConvexClient`, `api.*`), follow TypeScript strictness, use theme CSS variables for UI.
- **Ask first:** Adding npm dependencies, changing Convex schema in breaking ways, new env vars, large refactors across many files.
- **Never do:**
  - Commit or log `.env.local`, `.env*`, or any secrets (API keys, private keys). They are gitignored.
  - Edit `convex/_generated/*` (generated by Convex).
  - Remove or bypass auth checks in API routes (`getUid`, Convex `requireUserId`).
  - Assume Firebase or another backend; use Convex and WorkOS as implemented.

---

## Convex-specific notes

- **Schema:** Edit `convex/schema.ts` for new tables or fields. Keep optional fields backward-compatible when possible (e.g. legacy `contactId` alongside `contactIds`).
- **Mutations/queries:** Export from `convex/<domain>.ts`. Use `requireUserId(ctx)` for auth. Validators use `v.id("tableName")` for document ids.
- **API routes** that mutate or query Convex must use the **server** client (`getConvexClient(uid)`), not the client-side Convex React client, so auth is enforced per request.
