# AfterImage

The [Subjects reading typography refinement](docs/subjects-reading-typography-2026-10-02.md) uses the existing interface sans-serif for article prose, smaller introductions and objectives headings, and clearer paragraph spacing. Useful background is removed from all Subjects articles. Fresh independent visual acceptance covers every mechanism state and adjacent transition at both desktop widths in Light and Dark.

Readable Subjects titles open their lesson, alongside the existing “Read lesson” link. See [Subjects title navigation](docs/subjects-title-navigation-2026-10-02.md).

Subjects and Library now share the same quiz component, answer feedback and question navigation. The [quiz alignment note](docs/subjects-quiz-reader-alignment-2026-10-01.md) documents the reader cleanup, preserved scientific content and renewed appearance checks.

A personal reading compass and visual memory for research papers. The web app holds a short-lived shortlist, a searchable library, source-grounded notecards, and reading history. Reading happens in alphaXiv. Press <kbd>⌘K</kbd> anywhere in the signed-in app to search every known paper or paste an arXiv/alphaXiv link to add it to the library.

The [teaching-pipeline north star](docs/intuitivepapers-pipeline-north-star-2026-10-01.md) compares intuitivepapers.ai's stated process with our current generator and proposes claim ledgers, deeper lessons, typed interactive figures, and a Subjects shelf. The analysis is the design reference; [the Subjects implementation note](docs/subjects-original-library-2026-10-01.md) documents the original lesson catalog, private source audits, interactive reader, and release boundaries. The shared source extractor now retains unsectioned scientific main bodies, avoiding methods-only evidence for papers such as AlphaZero, and captures bounded appendix algorithm details after stable main-section evidence. Subjects generation binds exact primary passage IDs in private audits before independent source review, preventing synthesized quote strings from reaching publication. Source acquisition rejects embedded-PDF pointers as scientific body evidence and falls back to the public primary PDF. Explicit editorial refinements can remove multiple obsolete controls while retaining an authored experiment and requiring full source/quiz review. Reader refinements and animation contracts are documented in [reader refinement](docs/subject-reader-refinement-2026-10-01.md) and [original experiments](docs/subject-experiments-2026-10-01.md). Subject sliders track the pointer continuously while preserving discrete scientific counts; parameter playback explores both directions with brief endpoint holds. The NeRF ray experiment computes exact alpha/transmittance weights and a final RGB pixel on four declared intervals. SmoothQuant now preserves the matrix product through paired channel scaling; Mistral exposes causal eligibility and modulo cache writes in a declared read-before-write instance. Reader headings avoid duplicate numbering and inline formulas retain their grouping. Mechanism walkthroughs now fit stable object heights to their content and draw clear aligned dependencies directly.

The Documents tab adds a private shelf for uploaded Markdown guides and PDFs, with a formatted reader and original-file download. Document bytes live outside the frequently refreshed paper-library state. See `docs/documents.md` for storage, API, format, and release details.

Explicit private Subjects candidate review preserves the existing publication until every review passes and guards concurrent source, renderer, and sidecar changes. A safe prose-only sidecar rebind resets visual approval; see [candidate review boundaries](docs/subjects-original-library-2026-10-01.md). Exact evidence restoration skips private ledgers whose quotations no longer match the bound primary passages. The explicit `scripts/clean-subject-narration.ts --run` workflow replaces selected acquisition narration with scientific explanation through those same gates. Reader instances follow the current lesson and mechanism digests so revised storyboards start from a valid step.

The [Subjects figure relevance audit](docs/subject-figure-relevance-audit-2026-10-01.md) tracks which controls teach each paper's actual method. All 100 lessons now pass the local publication audit and appear as readable in Subjects. Source-gated updates adopted the SmoothQuant and Mistral contracts, removed unrelated CoT and VGG examples, and replaced selected extraction narration with scientific explanation; the final catalog-wide narration scan has no findings. The nineteen-control relevance pass passed full independent review and removed those unrelated operations locally. Remaining numerical computations, primary-source bindings, and quiz answers stay fixed; precise source-reviewed corrections clarify Switch capacity/compute, RT-2 attention labels, and OpenVLA’s evaluated quantization variant. The initial local milestone preceded the first Subjects production release; content review and desktop browser acceptance remain distinct. [Primary-source expansions](docs/subject-primary-gap-candidates-2026-10-01.md) for Geometry of Noise, DiffusionBlocks, and T5 passed all four independent review gates and published locally; mechanism bindings and desktop acceptance are reviewed separately. Newly authored T5 span-corruption and DiffusionBlocks training/inference walkthroughs passed source/state review with unchanged renderer geometry; the T5 lesson now replaces its image-patch analogy with the matching token example.

Final local acceptance covers 100 lessons, 203 interactive figures across 25 experiment families, and 14 source-reviewed mechanism walkthroughs with current Light/Dark desktop visual approval. All nineteen corrected readers render at the paper-reader scale with no KaTeX errors. The Whisper introduction-to-diagram gap is 40px, with a compact encoder and straight aligned dependencies. All 187 tests, typecheck, and the production build pass; production-mode checks confirm owner authentication, disabled development review routes, and no private review artifacts in build traces. See [the completion record](docs/subjects-original-library-2026-10-01.md#final-local-acceptance).

The production release integrates the newer paper typography, worked examples, and immediate preparation flow. Compact single-identity modules align title and detail at one left edge and place their token beside the text rather than in the card corner. All fourteen walkthroughs passed renewed desktop Light/Dark visual acceptance; the integrated 193-test suite, typecheck, production build, exact publication bindings, and private-artifact trace checks pass. Production release evidence is recorded in [Subjects release verification](docs/subjects-release-2026-10-01.md).

The [Subjects diagram system audit](docs/subject-diagram-system-audit-2026-10-01.md) diagnoses why fit/collision checks and four unstructured view descriptions admitted poor grouping. Generation now audits scientific ownership; every-state geometry enforces association, alignment, occupancy and arrow attachment. Versioned independent visual acceptance binds actual browser PNGs and text measurements to every beat, desktop theme/width, current styles/fonts and policy. `npm run subjects:verify` also runs before production builds, requiring the complete lesson and mechanism inventories and preventing a successful build from silently shipping withheld walkthroughs. The reader returns an allowlisted publication projection; review images and diagnostics remain private. Deployment pins installation with `npm ci` and the tested webpack build, while all Next route traces explicitly exclude private review/storage/runtime/environment files.

The corrective Subjects release is verified live: 219 tests pass, independent review covers 268 rendered states and 212 adjacent pairs, and all 100 production lessons render their 203 figures without KaTeX errors. The ordinary Library and Documents also load after recovering a recurring public Funnel outage through the documented existing-route restoration. See [current release evidence](docs/subjects-release-2026-10-01.md#corrective-release-verified-live) for scope and verification limits. Subjects article and shelf identities now share the Library's typography, while retaining its established Newsreader prose; [typography alignment](docs/subjects-typography-alignment-2026-10-01.md) records the shared style ownership and renewed appearance review. The combined typography/Cloudflare-compatible release passes 223 tests and is verified on the live NeRF, Subjects shelf, Library and Documents views.

Appearance supports System, Light, and Dark with a saved browser preference. A compact icon selector in the header and login screen provides direct selection, labeled tooltips, and native radio keyboard navigation. See `docs/appearance-control-2026-10-01.md` for the local refinement. The dark palette includes reader panels, assistant views, and SVG diagrams; SVG downloads preserve the selected colors. The October 1 web release is deployed; live appearance checks passed, while a pre-existing library connection failure prevents live reader/SVG acceptance. See `docs/dark-mode-2026-10-01.md` for release evidence and this verification limit.

Preparing a reading kit now opens the paper immediately while the save-and-queue request runs in the background. A compact progress section distinguishes submission from confirmed queue and worker activity, and offers status reconciliation after an interrupted request. The October 1 web release is deployed and passed live browser and authenticated API checks; see `docs/instant-preparation-2026-10-01.md` for behavior and release evidence.

Reviewed notecards are available while their visual guide and quiz finish. Preparation shows real worker milestones, elapsed time, queue position, and connection status; Documents loads independently of the paper library. See `docs/preparation-and-loading-2026-09-30.md` for behavior and release order.

Opening diagrams now support expressive object illustrations: occupied expert buckets, allocation lanes and sparse regions, repeated token identities, branching parameter vectors, sampled distributions, and calibrated gauges, alongside matrices, comparisons and dependency graphs. Planning names the relationship and geometric encoding the reader must be able to see; review rejects stage labels that hide the contribution. New panel diagrams use `explanatory-v3`, derive assignment counts, distinguish illustrative examples from sourced values, and recompose for phones. See `docs/diagram-creation-v3.md` for local verification and the required web-before-worker release order. Sequential public-paper evaluation can include the study figures and quiz with `--evaluate-paper ID --full`; see `docs/diagram-evaluation-reading-set.md` for evidence and generator adjustments.

The October 1 UI refinement extends the compact appearance control across discovery, library, documents, direction settings, search, and the paper assistant. Shared controls now use consistent sizing and focus states, calmer surfaces, and accessible filter state. Discovery retains the original numbered recommendation cards, purple reading actions, and “Your reading compass” accent; redundant section subtitles and the reader's provenance footer are removed. Source links and exported provenance remain available. See `docs/ui-refinement-2026-10-01.md` for scope and validation.

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

The public Next.js site and API routes now run on Vercel with SQLite and worker execution on macserver. The September 28 hybrid deployment was promoted after public-relay security tests from this Mac and edge, plus authenticated Vercel reads, writes, and polling. The bridge runs as restricted `_afterimage`, backed by root-owned code and a service-only database and credential; worker-account read denial and backup restore were verified. The original authorized Funnel port 8443 used TLS-terminated TCP forwarding to localhost port 3102; the verified Cloudflare cutover has now retired that mapping. `scripts/probe-storage-security.py` runs bounded external checks without accepting the bridge secret. Both worker agents run the compatible September 28 release. Backups stay on macserver and do not cover machine loss. See `docs/macserver-hybrid-hosting.md` for deployment evidence, remaining limits, and rollback precautions.

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
- `AFTERIMAGE_CF_ACCESS_CLIENT_ID` and `AFTERIMAGE_CF_ACCESS_CLIENT_SECRET` (Vercel only, when Cloudflare Access protects the bridge hostname)

Cloudflare Tunnel is live for Vercel-to-macserver storage. The combined release preserves reviewed Subjects typography and the Access-capable client; future production releases must include both. The restricted connector has no SQLite or signing-key access. Live library/document readers, quiet polling, both worker endpoints, both authentication gates, replay rejection, a disposable document round-trip and a macserver-local backup restore pass. Only AfterImage Funnel port 8443 was retired; unrelated routes remain. Backups remain on macserver and do not cover machine loss. See [Cloudflare storage ingress](docs/cloudflare-storage-ingress-2026-10-01.md) for evidence and rollback.

The user explicitly approved uploading these server-only values and using a production deployment target. Some deployment IDs in this repo may be historical; treat current deploy state as “current at run time via Vercel/hosting checks,” and use the latest deployment metadata when releasing updates.

The locally generated owner access key is stored privately in `.data/access-key.txt`. It is separate from the database password. Private files, reference assets, worker diagnostics, and local storage are excluded from deployment and version control.

The paper assistant acknowledges questions immediately, shows cached source previews on hover/focus, renders Markdown tables, and smoothly reveals cumulative replies. Figures adapt to the actual reading column when the sidebar is resized. See [assistant reader interactions](docs/assistant-reader-interactions-2026-09-30.md) for behavior and local verification.

## Typography and recall

Home-page headlines, section titles and paper cards share the reader's Overused Grotesk title typography, including medium weight and balanced wrapping. The home-page heading refinement lives in the shared UI layer.

New diagram generation uses a versioned semantic graph: code places nodes and routes arrows around text and shapes, with separate desktop and mobile layouts. Diagram-only repairs preserve the recall, and recall-only repairs preserve the graph. See `docs/diagram-generation-v2.md` for regression evidence and the required web-before-worker release order. `node --import tsx worker/index.ts --evaluate-paper 2312.07104` exercises generation and review without publishing or touching the queue.

Newsreader handles reading text, Overused Grotesk the interface, paper titles and diagram labels, Departure Mono conceptual headings, and IBM Plex Mono metadata. Paper titles use medium weight and balanced wrapping across the reader, discovery, library and related/recall links; see `docs/article-title-typography-2026-10-01.md`. Fonts and their OFL licenses are self-hosted under `public/fonts/`; review-time OpenType fonts live in `worker/fonts/`. SVG export captures the displayed diagram and embeds the fonts. The authored LoRA diagram has distinct desktop and mobile layouts, preserves A-then-B multiplication order, and keeps output notation clear of connectors.

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

The October 1 library outage came from Funnel's public ingress path while private Tailscale checks still passed. Public access was restored by refreshing ingress registration. Storage failures now have redacted server diagnostics and a bounded read-only retry; uncertain writes are never replayed. `scripts/check-storage-relay.mjs` verifies the actual public relays. See [storage reliability diagnosis](docs/storage-reliability-2026-10-01.md) for evidence and remaining limits.

The scientific animation authoring workflow is evaluated on EAGLE-3, LoRA and online softmax, with independent arithmetic checks and 117 browser samples. See [the evaluation and remaining coverage limits](docs/animation-example-evaluation-2026-10-01.md). Reviewed editorial worked examples are deployed in matching equation sections with autoplay, one Play/Pause control and inherited appearance; automatic worker animation generation remains future work. All 112 tests, the build, authenticated public API and reviewed asset hashes passed. See [reader integration and production verification](docs/worked-example-animation-release-2026-10-01.md).
