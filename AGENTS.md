# AGENTS.md — Dev Rules

## Git Workflow

- **NEVER push directly to `main`**
- Create a feature branch: `git checkout -b feat/description` or `fix/description`
- Make changes, commit with clear messages
- Push branch and create a PR: `gh pr create --base main --fill`
- CI must pass (lint + build) before merge
- Wait for human approval before merging

## Branch Naming

- `feat/` — new features
- `fix/` — bug fixes
- `refactor/` — code cleanup
- `chore/` — deps, config, CI

## Code Standards

- TypeScript strict mode
- Next.js App Router
- Tailwind CSS for styling
- Run `npm run lint` before committing
- Run `npm run build` to verify no type errors
