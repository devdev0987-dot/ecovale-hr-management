## Purpose
This project is a TypeScript React single-page prototype (Vite) for an HR admin UI. The guidance below is intentionally narrow and actionable to help an AI coding agent become productive quickly in this repository.

## Quick start (developer)
- Install dependencies: `npm install`
- Run development server: `npm run dev` (Vite)
- Build production bundle: `npm run build`
- Preview production build: `npm run preview`

If you need to run a focused change during development, `npm run dev` is sufficient — the app is client-only and served by Vite.

## High-level architecture
- Frontend-only React app (Vite + TypeScript). App entry: [index.tsx](index.tsx).
- Navigation: there is no `react-router`. The app switches pages by updating `activePage` in `AppContext` (`contexts/AppContext.tsx`); `components/layout/MainLayout.tsx` reads that value and renders the corresponding page component.
- Structure: `components/layout/*` (layout, Navbar, Sidebar), `components/ui/*` (reusable primitives like `Button`, `Input`, `Toast`, `ErrorBoundary`), and `pages/*` (screen implementations such as `NewEmployeePage.tsx`, `EmployeesPage.tsx`).
- Types: shared types live in [types/index.ts](types/index.ts).

## Data layer & persistence
- Central API surface: `services/storageService.ts` — callers should use its exported functions (`getEmployees`, `saveEmployee`, `getDesignations`, `saveDesignation`, etc.).
- Runtime backing: `storageService` delegates to `window.storage` when present and falls back to an in-memory mock seeded with demo data. This design keeps most of the app decoupled from a network/backend.
- To integrate a real backend: implement a `window.storage` shim or replace internals of `storageService` but keep the exported function signatures stable so pages/components remain untouched.
- Note: demo seed data lives in `services/storageService.ts`; tests and dev flows may expect empty `employees` unless `saveEmployee` is used.

## Important patterns & conventions (project-specific)
- Page switching: call `useAppContext().setActivePage('Employees' | 'Dashboard' | ...)`. Sidebar and Navbar components show examples.
- Toasts & feedback: use `useAppContext().showToast(message, type)` for consistent UI notifications.
- Error boundary: main content is wrapped in `components/ui/ErrorBoundary` inside `MainLayout`; prefer to keep thrown errors contained there.
- Forms and state: complex forms adopt `useReducer` + `formReducer` patterns (see `pages/NewEmployeePage.tsx`) — follow the same action shapes and state shape to keep consistency.
- Utilities: `utils/helpers.ts` contains shared logic such as `calculateSalaryFromCTC`, `generateUniqueId`, `fileToBase64`, and `generateAnnexureBase64` — reuse these.
- Constants: lookup lists (departments, locations) are in `utils/constants.ts` — reference them for form option values.
- Styling: components use Tailwind-like utility classes, but Tailwind may not be installed — check `package.json` before adding Tailwind-specific changes.

## Common developer tasks & examples
- Add a new employee: `pages/NewEmployeePage.tsx` calls `services/storageService.saveEmployee(...)` which persists via `window.storage` (or the memory fallback).
- Add a designation: call `services/storageService.saveDesignation(...)` — `NewEmployeePage` has a quick-add modal example.
- Export salary annexure: `utils/helpers.generateAnnexureBase64(...)` returns a base64 text file used by the UI export flow.
- Inspect runtime behavior: open browser DevTools and check `window.storage` for persisted keys and values when running `npm run dev`.

## Build / runtime gotchas discovered
- Tailwind-like utility classes exist (e.g., `Navbar.tsx`, `Sidebar.tsx`) but Tailwind is not necessarily present in `package.json`. Confirm the CSS setup before adding Tailwind features.
- Demo data lives in `services/storageService.ts`. By default `employees` may be empty until `saveEmployee` is invoked.
- `.env.local` may include optional keys (README mentions `GEMINI_API_KEY`) for optional integrations; the app runs without it.

## Where to change persistence to a real backend (practical steps)
1. Implement a `window.storage` shim that proxies to your backend (keeps `storageService` calls unchanged).
2. Or, adapt internals of `services/storageService.ts` to call network endpoints — keep function names and signatures identical to avoid refactoring pages.
3. Update seeded demo data removal and add migration/seed logic where necessary.

## Useful files to inspect (examples)
- [App.tsx](App.tsx) — mounts `AppContextProvider`, controls initial login vs main UI rendering.
- [index.tsx](index.tsx) — app bootstrap for Vite.
- [contexts/AppContext.tsx](contexts/AppContext.tsx) — central UI state (`activePage`, toasts, modal helpers).
- [services/storageService.ts](services/storageService.ts) — data API surface and demo seed fallback.
- [components/layout/MainLayout.tsx](components/layout/MainLayout.tsx) — page rendering and ErrorBoundary usage.
- [pages/NewEmployeePage.tsx](pages/NewEmployeePage.tsx) — example of `useReducer` form, quick-add modal, and `saveEmployee` usage.
- [utils/helpers.ts](utils/helpers.ts) and [utils/constants.ts](utils/constants.ts) — business rules and constants.
- [types/index.ts](types/index.ts) — shared TypeScript types used across pages and services.

## What the agent should avoid changing without confirmation
- Do not change `AppContext` semantics (`activePage`, `showToast`, modal helpers) without explicit approval — many components rely on these.
- Do not change `services/storageService.ts` exported function signatures; rewrite internals or provide a `window.storage` shim instead.
- Avoid broad layout or classname refactors (UI classes are used widely across pages) without a design review.

## If you need to run tests or lint (current state)
- There are no tests or lint scripts configured in `package.json` by default. Add focused tests and corresponding npm scripts when needed.

If you want, I can scaffold a minimal test harness and a small suite of unit tests around `utils/helpers.ts` and `services/storageService.ts`.

## Quick questions for reviewers
- Should `window.storage` remain the persistence abstraction, or do you prefer converting `storageService` to network calls directly?
- Is Tailwind an intended dependency for this project (many components use Tailwind-like classes)?

If any section is missing detail you'd like (example code snippets, more file cross-references, or a short testing scaffold), tell me which area to expand and I will update this file.
