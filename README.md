# AfterImage

A personal reading compass and visual memory for research papers. The web app holds a short-lived shortlist, a searchable library, source-grounded notecards, and reading history. Reading happens in alphaXiv.

## Repository status

This repository is currently tracked from a fresh local bootstrap. Feature work and hardening progress is implemented across `src/`, `worker/`, `scripts/`, `docs/`, and `tests/`, with `README.md` and `AGENTS.md` capturing the current operating assumptions.

Primary product status in this checkout:

- Paper import pipeline (alphaXiv search, arXiv retrieval, and fallback extraction)
- Source-grounded notecards with provenance and citation validation
- Recommendation workflow with ranking and review
- Desktop and portrait rendering checks for generated/queued diagrams
- Worker orchestration with leased jobs, heartbeats, and limited retries
- Environment-gated storage and authenticated API routes
- Migration-backed Supabase schema with single-owner state model

## Run locally

Requires Node 22.13+ (local SQLite fallback uses `node:sqlite`).

```sh
npm ci
cp .env.example .env.local # fill only the server credentials you need
npm run dev
```

Without Supabase configuration, development uses `.data/afterimage.sqlite`. Development on localhost skips the access-key login. Production requires an access key and configured Supabase storage. The production server refuses to fall back to an ephemeral local database.

```sh
npm test
npm run typecheck
AFTERIMAGE_BUILD_DIR=.next-production npm run build
AFTERIMAGE_BUILD_DIR=.next-production npx next start --hostname 127.0.0.1 --port 3001
node scripts/verify-production.cjs
```

`verify-api.ts` targets the local development server. `verify-production.cjs` checks local production authentication without printing credentials.

## Private storage

The existing **AfterImage** Supabase project in **Dev** is linked. The migration in `supabase/migrations/` creates an RLS-protected single-owner state record. Server-side optimistic version checks prevent concurrent library changes and worker completions from losing one another's changes. Browser clients have no database credentials or direct database access.

This deliberately small first version uses one JSON state record. A larger multi-user version should split papers, sources, notes, and jobs into separately paginated tables.

## Codex worker on the Mac server

AI work uses the signed-in **Codex CLI with ChatGPT authentication**. It does not use an OpenAI API key. The worker lives in `/Users/agarwalaarush/Projects/AfterImage` on `macserver`.

```sh
node --env-file=.env --import tsx worker/index.ts
# Single claim, useful for diagnostics:
node --env-file=.env --import tsx worker/index.ts --once
```

Worker configuration contains only `AFTERIMAGE_URL`, `AFTERIMAGE_WORKER_TOKEN`, and `CODEX_BIN`. The worker polls outbound; the Mac server does not expose an inbound public HTTP API. The web server hands out leased jobs, and heartbeats extend each lease. A timed-out job can be reclaimed, with a three-attempt ceiling.

For a notecard, the worker retrieves arXiv HTML sections with equation notation, falls back to bounded PDF extraction (up to 12 pages, 25 MB, 60 seconds), and finally to an explicitly labeled abstract. It generates a substantial technical recall with source-linked KaTeX equations, validates notation and citations, measures SVG font outlines for collisions, and reviews desktop (880 px) and portrait (350 px) renders against a concrete defect rubric. Failed drafts receive up to four repairs. Existing notecards and reading history remain available on failure. The model supplies a scene description, never arbitrary executable SVG markup. Generated text is XML-escaped.

Recommendations use goals, notes, statuses, and feedback. Codex proposes candidate arXiv IDs, the worker independently resolves their metadata and optionally retrieves arXiv search results, and a second pass ranks verified candidates. The web server independently imports any selected new IDs. Newly recommended papers and imports queue notecard creation. Recommendations change only on explicit refresh.

`--ignore-user-config`, a read-only Codex sandbox, an ephemeral task, a restricted child environment, and a per-job directory isolate generation from unrelated Mac server projects. User configuration is not changed. Paper content is treated as data, not instructions. This does not replace operating-system isolation against hostile inputs.

The LaunchAgent in `scripts/worker-launchd.plist` is installed as `dev.aarushagarwal.afterimage-worker` in the Mac server user session. It starts at login and restarts on failure. Its origin is `https://afterimage.aarushagarwal.dev`; the temporary local verification tunnel has been removed.

## Deployment

Target: `https://afterimage.aarushagarwal.dev`.
Vercel project: `afterimage`, scope `aarush-agarwals-projects`.

The following are **server-only** environment variables, with no `NEXT_PUBLIC_` prefix:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AFTERIMAGE_ACCESS_KEY`
- `AFTERIMAGE_WORKER_TOKEN`

The user explicitly approved uploading these server-only values and using a production deployment target. Some deployment IDs in this repo may be historical; treat current deploy state as “current at run time via Vercel/hosting checks,” and use the latest deployment metadata when releasing updates.

The locally generated owner access key is stored privately in `.data/access-key.txt`. It is separate from the database password. Private files, reference assets, worker diagnostics, and local storage are excluded from deployment and version control.

## Typography and recall

Newsreader handles reading text, Overused Grotesk the interface and diagram labels, Departure Mono conceptual headings, and IBM Plex Mono metadata. Fonts and their OFL licenses are self-hosted under `public/fonts/`; review-time OpenType fonts live in `worker/fonts/`. SVG export captures the displayed diagram and embeds the fonts. The authored LoRA diagram has distinct desktop and mobile layouts, preserves A-then-B multiplication order, and keeps output notation clear of connectors.

The former personal-notes editor has been removed. Existing stored notes are retained for export and search. Reading status remains in the paper header. Version-2 recalls include the problem, mechanism, evidence, caveats, significance, and optional sourced equations; Markdown export retains LaTeX.

## Current limits

- Single owner; access-key sign-in rather than multi-user accounts.
- arXiv and alphaXiv imports; arbitrary URLs and uploaded PDFs are not supported.
- PDF fallback uses an isolated Python environment with `pypdf==6.18.1`; install with `python3 -m venv .venv` then `.venv/bin/pip install pypdf==6.18.1`. It extracts at most 12 pages, not necessarily the entire paper. Abstract-only results remain shorter and explicitly labeled.
- Generated diagrams use a bounded vocabulary of original geometric primitives. They are editable SVG exports; there is no in-app vector editor.
- Recommendation and generation jobs share a 12-job-per-hour limit. The Mac server and its signed-in Codex session must be available.
- A model review is a quality check, not a guarantee of scientific correctness; each recap links to the exact saved source excerpts.

See `docs/design-reference.md`, `docs/development-plan.md`, and `docs/implementation-status.md` for reference evidence and validation status.
