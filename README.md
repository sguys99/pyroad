# pyRoad

pyRoad is an interactive Python learning platform for elementary school students. It combines a quest-based curriculum, an AI animal tutor, and in-browser Python execution so learners can start coding without installing a local environment.

For the Korean version of this document, see [docs/README(kr).md](docs/README%28kr%29.md).

## Overview

- Korean-first Python learning experience designed for young learners
- Browser-based coding powered by Pyodide
- World map and quest progression structure
- AI tutor support for introductions and step-by-step hints

## Implementation Status

- [x] Phase 0: Project bootstrap and infrastructure
- [x] Phase 1: Google login and protected routes
- [x] Phase 2: Curriculum seed data and world map
- [x] Phase 3: Quest screen shell and Pyodide code execution
- [x] Phase 4: AI tutor API, quest intro, and hints
- [x] Phase 5: Code validation and quest completion flow
- [x] Phase 6: Gamification
- [x] Phase 7: Final project guide
- [x] Phase 8: Responsive UI polish and animations
- [x] Phase 9: Integrated testing and deployment

## Tech Stack

- Framework: `Next.js 15`, `React 19`, `TypeScript`
- Styling: `Tailwind CSS v4`
- Auth / Database: `Supabase`
- AI Tutor: `Anthropic SDK`
- Python Runtime: `Pyodide`
- Editor: `CodeMirror 6`
- Tooling: `ESLint`, `Vitest`, `Playwright`

## Getting Started

### 1. Requirements

- Recent Node.js LTS
- A Supabase project
- Google OAuth configured in Supabase Auth
- An Anthropic API key

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env` based on `.env.example`.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### 4. Apply Supabase schema and seed data

This repository includes:

- `supabase/migrations/00001_create_initial_schema.sql`
- `supabase/migrations/00002_handle_new_user_trigger.sql`
- `supabase/seed.sql`

Apply the migrations and seed data to prepare the `users`, `stages`, `quests`, `user_progress`, and `user_badges` tables.

### 5. Run the development server

```bash
npm run dev
```

The default local URL is `http://localhost:3000`.

## Direction

The goal of pyRoad is to make a child's first Python experience simple, playful, and immediately rewarding. The current repository already includes the core MVP foundation for authentication, world progression, quest UI, AI tutor interaction, and browser-based Python execution.
