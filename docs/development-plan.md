# AfterImage development plan

Status: proposed implementation plan, 2026-09-12. The repository began empty. Only planning and reference artifacts have been created.

Production target: **https://afterimage.aarushagarwal.dev**. This domain is a deployment requirement, not a currently verified deployment.

## Product contract

AfterImage helps Aarush choose a worthwhile paper, preserve its essential ideas as a short illustrated card, and recover those ideas later. Reading happens in alphaXiv or the original source. Initial success means better reading choices and useful recall, not library size, clicks or time spent in the app.

The user endorsed a small reading compass and then explicitly restored automatic technical diagrams and short notecard summaries to its scope. Keep both. An embedded PDF reader, annotation engine, PDF chat, sprawling graph, browser extension, and full research platform are outside the first release.

## Screens and complete flows

| Surface | Primary action | Result and next action | Return path |
|---|---|---|---|
| First use | Add current learning/research goal and a few known papers | Useful initial context; request first recommendations | Edit goals later without repeating onboarding |
| Next reads `/` | Choose one of 2–3 recommendations | See rationale, focus and suggested depth; open alphaXiv in a new tab | AfterImage remains open with the selection and queue preserved |
| Continue section | Reopen an in-progress paper | Resume external reading; capture a takeaway when ready | Return to the same card or home selection |
| Library `/library` | Search title, topic, mechanism or own notes | Filter results; open a compact recall card | Back restores query, filters and scroll position |
| Paper `/papers/[id]` | Review the idea or open the source | Diagram + short recap + own judgment; edit notes/status, inspect evidence | Return to originating list or recommendation batch |
| Add paper dialog | Paste arXiv/alphaXiv/DOI link | Normalize identity, deduplicate, persist metadata immediately, queue generation | Open saved card; leave dialog while generation continues |
| Direction `/direction` | Update goals, open questions and recommendation feedback | Future choices use explicit current context | Return home without automatically reshuffling current choices |
| Export in settings | Export library and notes | Download portable JSON/Markdown and generated SVG artifacts | Return to settings/library |

Proposed card structure: title/authors/year/source; one-line core idea; one principal SVG; concise problem/mechanism/evidence/limitation fields; editable takeaway/why-I-care/open-question/next-action; source links and related cards. Factual drafts and personal judgment are stored separately. Regeneration cannot overwrite user writing.

Library search adopts the measured Find a Lab treatment: one calm raised surface, label and shortcut hint, tactile search input, status/topic controls, separate result count. Keep shortcut handling inactive while typing into other controls. Search covers real persisted records, with meaningful empty/loading/error states.

## Development order

### 1. Establish the visual and content quality bar

Use `design-reference.md` and the existing quiet-tech skill to define AfterImage tokens and reusable components. Implement the search panel, paper preview and compact recall page with a few real, explicitly identified sample papers. Verify desktop and mobile renders before extending the UI.

The gradient-descent lab reference further specifies the recall-page hierarchy: a dominant diagram surface, a coordinated supporting row for evidence and personal judgment, and a quiet shared metadata/action strip. Apply common corners, padding, shadows and mono labels across these roles; allow a faint semantic tint on the primary surface. Preserve the paper reference's serif reading mode. This is a composition requirement, not an expansion into a full simulator or a dashboard of artificial metrics.

In the same early milestone, prove a small generation pipeline on three unfamiliar papers with different explanatory needs: a comparison, a spatial/matrix relationship, and a mechanism/state change. Reference-paper recreations alone do not prove generalization. Record source evidence, outputs, visual defects, repair count, runtime and cost. This is the highest-uncertainty capability and should be exercised early.

Exit: the notecard is useful at a glance, the search panel feels right, and the generated diagrams demonstrate factual and visual competence beyond the supplied examples. Demo data is never represented as personal history or live recommendations.

### 2. Complete the durable personal-library loop

Add authentication, paper identity/version handling, saved papers, reading states, goals, personal notes, full-text search and export. Make link import idempotent across arXiv and alphaXiv URLs for the same paper. Save metadata before slower extraction begins. Model metadata-only, queued, extracting, generating, ready, needs-review and failed states distinctly.

Exit: add paper → open externally → record understanding → reload → find again → inspect card → export works with persisted data. Retry cannot create duplicates or lose notes. Deleting a saved item uses a recoverable archive initially.

### 3. Integrate source-grounded card and diagram generation

Prefer available paper HTML/structured text, with a server-side PDF extraction fallback. This is evidence extraction for concise cards, not a custom reader or coordinate-based annotation system. Store source version, section/page locators and relevant passages. If only an abstract is available, label that scope and do not fabricate method details or numeric evidence.

Pipeline:

1. Extract a compact evidence record: problem, central claim, mechanism, result conditions, limitations and supporting spans.
2. Draft the short factual card and select the one idea the diagram should teach.
3. Propose a few composition options, select one, and emit a typed scene with objects, text, groups, relations and source links.
4. Lay out the scene using measured fonts and reusable primitives: nodes, matrices, gates, reservoirs, tokens, isometric volumes and annotations. Permit bounded custom vector geometry when the concept calls for it.
5. Render SVG with stable concept IDs and accessible text/description. Generate a separate mobile composition where needed.
6. Check semantic faithfulness separately from layout. Render at actual card and mobile sizes; detect clipping, text collisions, undersized labels, connector ambiguity and poor contrast. Use image critique for composition.
7. Repair within a fixed attempt/cost limit. Save the accepted version or clearly flag the remaining failure; leave the paper and notes usable.

Render only a validated scene grammar into SVG. Do not run model-authored JavaScript or allow executable SVG, external references or arbitrary HTML. This is part of the generator implementation, not an extra user workflow.

Interactive figures use predefined state transitions tied to evidence. A toggle can compare two conditions while keeping an invariant structure; it must not imply simulated experimental results. The first release can ship static diagrams where they communicate the idea fully.

Exit: accepted figures are readable, editable and sourced; invalid ones do not silently become trusted cards. Every generation has a persistent ID, source version, prompt/model version, status, validation result and cost record. Reopening never triggers generation again.

### 4. Add the reading compass

Retrieve real candidates from scholarly sources and related-paper references. Normalize identifiers and verify metadata before ranking. Start with a small candidate pool driven by explicit goals and questions. Treat preference matching, prerequisite coverage and contrary/adjacent evidence as ranking reasons rather than quotas.

Rank using current goals, what the user says they understand, unresolved questions, useful/saved/dismissed feedback, relevance and duplication. Opening a paper is not proof of understanding. A cold start asks for minimal direction and a few known papers; it does not invent a profile.

Persist batches of up to three recommendations with paper IDs, the goal/question each addresses, why-now explanation, suggested reading focus and depth. Show fewer when evidence is weak. Keep the batch stable until user action or deliberate refresh; use cached candidates and avoid model calls on every page load. Feedback options include useful, already know, too advanced, irrelevant and later.

Prepare concise previews for the chosen batch. Generate fuller recap diagrams when papers are saved or explicitly requested, with bounded pre-generation only for the 2–3 selected recommendations if the measured cost permits it.

Exit: each recommendation points to a real paper and a specific user need; dismissal persists; repeated visits do not shuffle the plan. Evaluate against what Aarush would have chosen unaided, then whether the recommendation led to a useful finished reading session. One-week resurfacing can be added after the basic recall loop is proven.

### 5. Production verification and deployment

Ship a preview, exercise the real loop there, then attach `afterimage.aarushagarwal.dev`. Verify authentication redirects, private data access, refresh persistence, import and generation recovery, note editing, search, exported content, mobile rendering and external source navigation. Test failed extraction and unavailable worker behavior; saved cards and personal notes must remain available.

Before DNS changes, inspect the current domain zone and hosting project. Use the host-provided record for this subdomain and preserve the root website. Configure HTTPS and exact production authentication callback URLs. No DNS changes or public deployment have been made by this planning task.

## Proposed architecture

- Next.js App Router + TypeScript + React, with a small custom design-token/component layer. Accessible UI primitives may be used underneath; their default appearance is not the design.
- Vercel for the web app and short authenticated API operations.
- A dedicated managed PostgreSQL database for papers, cards, goals, feedback, jobs and recommendation batches. Supabase is the proposed combined database/auth/storage option, subject to checking available account capacity. Do not share an unrelated project's database by default.
- PostgreSQL full-text search across metadata and the user's notes first. Add embeddings only when real recall queries demonstrate a gap. No vector-search dependency for the initial library.
- Private object storage for extracted evidence and generated assets; source version and ownership are explicit.
- A separate background worker for paper retrieval, model calls, SVG rendering and repair. Durable jobs have leases, bounded retries and idempotency keys; web requests enqueue them and return quickly.
- The worker can run locally during development. Production placement follows a short check of the existing Mac server: use it if healthy and operationally simple, or a managed container if not. Keep this worker portable; the web app and saved library should not depend on the worker being online. This hosting choice remains unresolved until inspection, rather than inventing a new provider commitment now.
- If using the Mac server, use outbound job polling; do not expose a new public Mac API. Model keys stay server-side. Store generation logs/cost without leaking paper notes into public logs.

The separation lets the expensive SVG workflow run independently of browser requests while keeping ordinary reading and recall fast.

Official references checked for the proposal: https://nextjs.org/docs/app ; https://supabase.com/docs/guides/database/full-text-search ; https://vercel.com/docs/domains/working-with-domains/add-a-domain . Exact SDK and runtime choices will be verified when implementation starts.

## Minimal data model

`papers` (canonical identity and metadata), `paper_versions`, `source_spans`, `saved_papers` (owner and reading status), `recall_cards` (versioned factual draft), `personal_notes`, `diagram_versions` (scene/SVG/validation), `goals`, `open_questions`, `paper_relations`, `recommendation_batches`, `recommendation_items`, `feedback`, and `generation_jobs`.

Use stable IDs and timestamps. Keep source facts, generated interpretations, and user judgments distinct. Exact table grouping can be simplified during implementation without collapsing those distinctions.

## Scope and acceptance

Initial release includes the next-reads homepage, link import, compact illustrated cards, personal judgment, reading status, search, related-card links, export, authentication and deployment. Later possibilities are cross-paper synthesis and resurfacing, driven by actual use. No extra task or automation is created by this plan.

Verification focuses on the complete user loop, source fidelity and useful recall. Automated checks should cover consequential failures: duplicate import, lost note edits, unauthorized access, worker retries, invalid SVG, citation/version mismatch and unstable recommendation batches. Visual review covers desktop, mobile, long titles, dense diagrams, focus and reduced motion. A working UI alone does not establish diagram accuracy or recommendation quality.
