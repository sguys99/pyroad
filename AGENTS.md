# Repository Guidelines

## Project Structure & Module Organization
`src/app` contains the Next.js App Router pages, layouts, and API routes. Protected screens live under `src/app/(protected)`, and the tutor API is in `src/app/api/tutor/route.ts`. Shared UI lives in `src/components`, with feature folders such as `quest/` and `world/`. Reusable logic and integrations are in `src/lib` (`supabase/`, `pyodide/`, `tutor/`, `world/`). Static assets go in `public/`, product docs in `docs/`, and database schema changes in `supabase/migrations/` plus `supabase/seed.sql`.

## Build, Test, and Development Commands
Use `npm` for all local work:

- `npm run dev` starts the Next.js dev server with Turbopack.
- `npm run build` creates the production build.
- `npm run start` serves the built app locally.
- `npm run lint` checks ESLint rules.
- `npm run lint:fix` applies safe lint fixes.
- `npm run test` runs Vitest in `jsdom`.
- `npm run test:e2e` runs Playwright end-to-end tests.

## Coding Style & Naming Conventions
This project uses TypeScript strict mode and the `@/*` path alias for `src/*`. Prettier enforces 2-space indentation, semicolons, single quotes, trailing commas, and an 80-character line width. Follow existing naming patterns: React components in PascalCase (for example, `QuestShell.tsx`), hooks as `useX`, and utility modules in camelCase. Default to server components in `src/app`; add `'use client'` only where browser APIs, editor state, or animations require it.

## Testing Guidelines
Vitest and Playwright are configured, but no committed test suite exists yet. Add unit tests as `*.test.ts` or `*.test.tsx` near the code they cover, and reserve Playwright for full user flows. At minimum, new behavior in tutor flows, Pyodide execution, and protected routes should ship with automated coverage or a short note explaining the gap.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries with an emoji prefix, such as `:sparkles: Complete phase 4: AI tutor api and quest`. Keep that style, but make the scope explicit. Pull requests should include a concise description, linked issue or phase reference, notes on schema or env changes, and screenshots or recordings for UI work.

## Security & Configuration Tips
Copy `.env.example` to `.env.local` and keep secrets out of git. Required values include Supabase keys and `ANTHROPIC_API_KEY`. When changing auth or database behavior, update both `supabase/migrations/` and seed data together.
