# Repository Guidelines

> Short summary for non-Claude agents. The authoritative rules are in `CLAUDE.md` (and `docs/4.upgrade-plan.md` §2); if this file disagrees, follow `CLAUDE.md`.

## Project Structure & Module Organization
`src/app` contains the Next.js App Router pages, layouts, and API routes. Protected screens live under `src/app/(protected)`, and the tutor API is in `src/app/api/tutor/route.ts`. Shared UI lives in `src/components`, with feature folders such as `quest/` and `world/`. Reusable logic and integrations are in `src/lib` (`supabase/`, `pyodide/`, `tutor/`, `world/`). Static assets go in `public/`, product docs in `docs/`, and database schema changes in `supabase/migrations/`. Quest content lives in `content/worlds/` (YAML); `supabase/seed.sql` is generated from it by `npm run content:build`.

## Build, Test, and Development Commands
Use `npm` for all local work:

- `npm run dev` starts the Next.js dev server with Turbopack.
- `npm run build` creates the production build.
- `npm run start` serves the built app locally.
- `npm run lint` checks ESLint rules.
- `npm run lint:fix` applies safe lint fixes.
- `npm run test` runs Vitest (watch; `npx vitest run` for one pass).
- `npm run test:e2e` runs Playwright end-to-end tests.

## Coding Style & Naming Conventions
This project uses TypeScript strict mode and the `@/*` path alias for `src/*`. Prettier enforces 2-space indentation, semicolons, single quotes, trailing commas, and an 80-character line width. Follow existing naming patterns: React components in PascalCase (for example, `QuestShell.tsx`), hooks as `useX`, and utility modules in camelCase. Default to server components in `src/app`; add `'use client'` only where browser APIs, editor state, or animations require it.

## Testing Guidelines
Unit tests (Vitest) live in `__tests__/` folders next to the code they cover; Playwright specs live in `e2e/` (see `e2e/README.md`). Content answers run with `npm run test:content`, RLS/permissions with `npm run test:rls:ci`. At minimum, new behavior in tutor flows, Pyodide execution, and protected routes should ship with automated coverage or a short note explaining the gap.

## Commit & Pull Request Guidelines
Commits use `<emoji> <type>: <Korean summary> (<task ID>)`, e.g. `✨ feat: 닉네임 설정 화면 추가 (P3-05)` — one task item per commit (details in `CLAUDE.md`). Pull requests should include a concise description, linked issue or phase reference, notes on schema or env changes, and screenshots or recordings for UI work.

## Security & Configuration Tips
Copy `.env.example` to `.env.local` and keep secrets out of git. Required values are the three Supabase keys; the server does not use `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` (students may register their own keys), and `GEMINI_API_KEY` is optional and not used in production (see `.env.example`). Schema changes go in a new numbered migration; never edit `supabase/seed.sql` by hand.
