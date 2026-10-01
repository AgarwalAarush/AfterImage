# AfterImage

A personal reading compass and visual memory for research papers. The web app holds a short-lived shortlist, a searchable library, source-grounded notecards, and reading history. Reading happens in alphaXiv. Press <kbd>⌘K</kbd> anywhere in the signed-in app to search every known paper or paste an arXiv/alphaXiv link to add it to the library.

The Documents tab adds a private shelf for uploaded Markdown guides and PDFs, with a formatted reader and original-file download. Document bytes live outside the frequently refreshed paper-library state. See `docs/documents.md` for storage, API, format, and release details.

Appearance supports System, Light, and Dark with a saved browser preference. The dark palette includes reader panels, assistant views, and SVG diagrams; SVG downloads preserve the selected colors. See `docs/dark-mode-2026-10-01.md`.

Reviewed notecards are available while their visual guide and quiz finish. Preparation shows real worker milestones, elapsed time, queue position, and connection status; Documents loads independently of the paper library. See `docs/preparation-and-loading-2026-09-30.md` for behavior and release order.

Opening diagrams now support expressive object illustrations: occupied expert buckets, allocation lanes and sparse regions, repeated token identities, branching parameter vectors, sampled distributions, and calibrated gauges, alongside matrices, comparisons and dependency graphs. Planning names the relationship and geometric encoding the reader must be able to see; review rejects stage labels that hide the contribution. New panel diagrams use `explanatory-v3`, derive assignment counts, distinguish illustrative examples from sourced values, and recompose for phones. See `docs/diagram-creation-v3.md` for local verification and the required web-before-worker release order. Sequential public-paper evaluation can include the study figures and quiz with `--evaluate-paper ID --full`; see `docs/diagram-evaluation-reading-set.md` for evidence and generator adjustments.

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
- Separate private document storage and reader for Markdown and PDF uploads

## Run locally

Requires Node 22.13+ (local SQLite fallback uses `node:sqlite`).

```sh
npm ci
cp .env.example .env.local # fill only the server credentials you need
npm run dev
```

Without Supabase configuration, development uses `.data/afterimage.sqlite`, including a separate `documents` table for uploaded files. Development on localhost skips the access-key login. Production requires an access key and an explicit storage mode; the selected hybrid deployment uses `AFTERIMAGE_STORAGE=macserver` on Vercel and `sqlite` on the restricted macserver bridge. The production server refuses to fall back to an ephemeral local database.

```sh
npm test
npm run typecheck
AFTERIMAGE_BUILD_DIR=.next-production npm run build
AFTERIMAGE_BUILD_DIR=.next-production npx next start --hostname 127.0.0.1 --port 3001
node scripts/verify-production.cjs
```

`verify-api.ts` targets the local development server. `verify-production.cjs` checks local production authentication without printing credentials.

## Private storage

The existing **AfterImage** Supabase project in **Dev** remains available as a historical export and explicit fallback, but production SQLite is authoritative. Server-side optimistic version checks prevent concurrent library changes and worker completions from losing one another's changes. Browser clients have no database credentials or direct database access.

The public Next.js site and API routes now run on Vercel with SQLite and worker execution on macserver. The September 28 hybrid deployment was promoted after public-relay security tests from this Mac and edge, plus authenticated Vercel reads, writes, and polling. The bridge runs as restricted `_afterimage`, backed by root-owned code and a service-only database and credential; worker-account read denial and backup restore were verified. Authorized Funnel port 8443 uses TLS-terminated TCP forwarding to localhost port 3102 so incomplete unauthorized uploads receive an immediate rejection. `scripts/probe-storage-security.py` runs bounded external checks without accepting the bridge secret. Both worker agents run the compatible September 28 release. Backups stay on macserver and do not cover machine loss. See `docs/macserver-hybrid-hosting.md` for deployment evidence, remaining limits, and rollback precautions.

The Documents shelf keeps owner-uploaded Markdown and PDFs in a separate table in that same SQLite file. Deploy the updated storage bridge with `scripts/install-documents-storage-macserver.sh` and verify its local backup/restore before enabling the Vercel routes. See `docs/documents.md` for the format, API, and release order.

This deliberately small first version uses one JSON state record. A larger multi-user version should split papers, sources, reading entries, and jobs into separately paginated tables.

Background polling uses a small state version check and worker queue projections so idle checks do not repeatedly transfer the full JSON record. The worker presence timestamp uses `afterimage_state.updated_at`; see `docs/egress-polling-2026-09-25.md` for the quota diagnosis and verification limits.

## Codex worker on the Mac server

AI work uses the signed-in **Codex CLI with ChatGPT authentication**. It does not use an OpenAI API key. The worker lives in `/Users/agarwalaarush/Projects/AfterImage` on `macserver`.

```sh
node --env-file=.env --import tsx worker/index.ts
# Single claim, useful for diagnostics:
node --env-file=.env --import tsx worker/index.ts --once
```

Worker configuration requires only `AFTERIMAGE_URL`, `AFTERIMAGE_WORKER_TOKEN`, and `CODEX_BIN`; an optional `OPENALEX_API_KEY` raises the discovery API budget. The worker polls outbound to the Vercel API. The selected hybrid storage bridge is a separate, signed HTTP service exposed through an HTTPS tunnel at cutover. The web server hands out leased jobs, and heartbeats extend each lease. A timed-out job can be reclaimed, with a three-attempt ceiling.

For a generated paper, the worker retrieves arXiv HTML sections with equation notation, falls back to bounded PDF extraction (up to 12 pages, 25 MB, 60 seconds), and finally to an explicitly labeled abstract. It generates a substantial technical recall with source-linked KaTeX equations, validates notation and citations, measures SVG font outlines for collisions, and reviews desktop (880 px) and portrait (350 px) renders against a concrete defect rubric. A successful notecard automatically queues the dependent visual study guide and quiz. The reader sees both jobs as one preparation flow—evidence, explanation, notecard, review, then visual guide—and reviewed notecards become readable immediately while supplements remain private until their own checks pass. The Libraries.dev `thinking-orbs` indicator is shown only while work is active, maps directly to real worker stages, and respects reduced-motion preferences; raw diagnostics remain private. Failed drafts receive up to four repairs. Existing complete packages and reading history remain available when a regeneration fails. The model supplies a scene description, never arbitrary executable SVG markup. Generated text is XML-escaped.

Recommendations use goals, reading states, and feedback. Codex plans several discriminative relevance and recent-paper queries, including a standing adjacent lane for world models, learned dynamics, and model-based agents. The worker searches arXiv and OpenAlex independently, merges and deduplicates their arXiv-linked results, resolves canonical arXiv metadata, and only then asks a second pass to rank verified candidates. Retrieval diagnostics remain stored for operational review instead of appearing on the reading home page. Marking a paper as reading/read or finishing a review quietly queues updated suggestions when worker capacity allows; manual refresh remains available. Newly recommended papers remain metadata-only until the reader requests a kit; explicit imports still queue the complete reading-kit flow.

The global paper palette also searches beyond the saved library. Debounced title, author, and topic queries run through an authenticated server route against arXiv and OpenAlex; importable canonical arXiv results can be added directly with the keyboard. Pasted arXiv and alphaXiv links continue to use the same intake path.

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
- `AFTERIMAGE_STORAGE=macserver`
- `AFTERIMAGE_BACKEND_URL`
- `AFTERIMAGE_BACKEND_TOKEN`

The user explicitly approved uploading these server-only values and using a production deployment target. Some deployment IDs in this repo may be historical; treat current deploy state as “current at run time via Vercel/hosting checks,” and use the latest deployment metadata when releasing updates.

The locally generated owner access key is stored privately in `.data/access-key.txt`. It is separate from the database password. Private files, reference assets, worker diagnostics, and local storage are excluded from deployment and version control.

The paper assistant acknowledges questions immediately, shows cached source previews on hover/focus, renders Markdown tables, and smoothly reveals cumulative replies. Figures adapt to the actual reading column when the sidebar is resized. See [assistant reader interactions](docs/assistant-reader-interactions-2026-09-30.md) for behavior and local verification.

## Typography and recall

New diagram generation uses a versioned semantic graph: code places nodes and routes arrows around text and shapes, with separate desktop and mobile layouts. Diagram-only repairs preserve the recall, and recall-only repairs preserve the graph. See `docs/diagram-generation-v2.md` for regression evidence and the required web-before-worker release order. `node --import tsx worker/index.ts --evaluate-paper 2312.07104` exercises generation and review without publishing or touching the queue.

Newsreader handles reading text, Overused Grotesk the interface and diagram labels, Departure Mono conceptual headings, and IBM Plex Mono metadata. Fonts and their OFL licenses are self-hosted under `public/fonts/`; review-time OpenType fonts live in `worker/fonts/`. SVG export captures the displayed diagram and embeds the fonts. The authored LoRA diagram has distinct desktop and mobile layouts, preserves A-then-B multiplication order, and keeps output notation clear of connectors.

Post-reading capture has been removed from the active schema, API, assistant, search, and exports. Legacy state is upgraded to schema version 2 by retaining only paper status and reading timestamps. Reading status remains in the paper header. Version-2 recalls include the problem, mechanism, evidence, caveats, significance, and optional sourced equations; Markdown export retains LaTeX.

Walkthrough tables use a compact 15px body scale so procedural detail stays subordinate to the surrounding 16px recall prose.

## Current limits

- Single owner; access-key sign-in rather than multi-user accounts.
- arXiv and alphaXiv imports; OpenAlex broadens discovery but only records with a resolvable arXiv version can enter the current paper pipeline. DOI-only articles, arbitrary URLs, and uploaded PDFs are not yet supported.
- Documents accept Markdown and PDF uploads up to 4 MB; they remain separate from paper imports, recommendations, and generated notecards.
- PDF fallback uses an isolated Python environment with `pypdf==6.18.1`; install with `python3 -m venv .venv` then `.venv/bin/pip install pypdf==6.18.1`. It extracts at most 12 pages, not necessarily the entire paper. Abstract-only results remain shorter and explicitly labeled.
- Generated diagrams use a bounded vocabulary of original geometric primitives. They are editable SVG exports; there is no in-app vector editor.
- Recommendation and generation jobs share a 12-job-per-hour limit. The Mac server and its signed-in Codex session must be available.
- A model review is a quality check, not a guarantee of scientific correctness; each recap links to the exact saved source excerpts.

See `docs/design-reference.md`, `docs/development-plan.md`, and `docs/implementation-status.md` for reference evidence and validation status.

Local reading-set evaluations also exercise study figures with the shared semantic illustration vocabulary. Phone matrices and heatmaps recompose as labelled rows with readable conditions, timeline copy stays complete, and ratio charts show parity. Memory panels anchor transfers to actual grids and can show complete tile-visit schedules. Native state traces connect a shared posterior to observed replay and imagined futures with explicit action/observation roles. Native token trees draw shared prefixes, a verifier boundary, and one accepted path with a separate target fallback. Tall diagrams receive overlapping scroll views during visual review. Evaluation-only `--diagram-focus` keeps planning and review aligned to a source-supported narrow visual lesson while preserving full notecard coverage. Explicit model-capacity failures receive at most two bounded step retries; rejected content never bypasses review. See `docs/diagram-evaluation-reading-set.md` for observed failures and approved artifacts.

Next reads now offers compact summaries and an explicit Prepare reading kit action. Recommendation cards follow the compact image mockup with a full-width reading action and overflow feedback. Library cards use one status label and complete fitted diagrams without a repeated bottom bar; unprepared readers retain their abstracts. Desktop is the product and release acceptance target. See [reading discovery and library previews](docs/reading-discovery-qol-2026-09-30.md) for the verified failure causes, graph-ID repair, and release order.

The scientific illustration web/API and regular macserver worker are released on October 1; see [release verification](docs/scientific-diagram-release-2026-10-01.md). Stored diagrams require explicit reviewed regeneration.
