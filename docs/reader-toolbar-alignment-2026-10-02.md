# Reader toolbar alignment

Based on freshly fetched `origin/main` at `0e18dc7`.

The shared reader now places its Lesson/Notecard and Paper switch inside the original-paper PDF toolbar, on the same row as page navigation, zoom and source actions. Search is removed from the toolbar and opens with ⌘F or Ctrl+F in a floating panel beneath it, following the supplied alphaXiv reference. Escape closes the panel and restores focus without closing an open assistant. Enter and Shift+Enter cycle forward/backward through individual occurrences; the panel includes Highlight all, Match case and Whole words options. Lesson/Notecard mode retains its existing navigation. The PDF component remains mounted after opening, preserving its document, zoom, search and scroll state when switching views.

The view switch and PDF controls form one centered group over the paper pane, including when the assistant opens. The switch remains visible while PDF controls scroll horizontally when the available reader column is narrow. The assistant launch control sits at the far right of the PDF toolbar. Navigation uses 28px arrows around a compact, right-aligned page-number/count pair; zoom and source actions use 32px controls, consistent centers and group separators; the Lesson/Paper switch is a compact segmented pill. Dark mode uses explicit selected surfaces and readable accent text (12.25:1 selected-text contrast), and restores the dark muted-text variables that the shared stylesheet previously overrode. Existing Geist design guidance informed the restrained hierarchy and spacing while preserving the installed font assets. This is a web presentation change with no worker, storage or data migration.

## Validation

- `npm run typecheck` passed.
- All three existing PDF-location/proxy tests and four new occurrence-search/Unicode range tests passed.
- The complete test suite passed: 250 passed, one existing wall-clock soak test skipped, zero failures.
- Browser checks on the DPO reader covered Light and Dark, 1440px desktop with the assistant closed/open, and 900px compatibility. The switch and controls share a vertical center; neither viewport produced page overflow. At 900px the controls have local horizontal overflow rather than wrapping into a second row.
- Lesson → Paper → Lesson → Paper navigation leaves exactly one visible view switch and retains the PDF component. Assistant open/close remains functional.
- The remote PDF fetch failed in this environment. A clearly labeled two-page local PDF fixture was supplied in the verification browser only, with no production or application-source fixture. Browser checks exercised rendered text, six individual results, exact word highlighting, next/previous navigation and cross-page wrapping, case-sensitive results, whole-word filtering, and keyboard dismissal. Original-paper fetch and download remain unverified here.
- The toolbar measures 61px high with all four navigation/zoom icon centers at the same vertical coordinate. The 560px find panel stays inside the reader at 900px. Final Light/Dark screenshots use the labeled local fixture.
- The toolbar control group and paper-pane centers coincide: x=752px at 1440px with the assistant closed, x=547px with it open, and x=482px at 900px.
- A separate reviewer inspected the final toolbar, assistant-open, 900px Light, Dark and floating-search screenshots and found no visual blocker. Native browser checks separately verified focus restoration, keyboard shortcuts and hitbox dimensions.
- The new search source is included in Subjects presentation fingerprints so its behavior remains covered by the existing publication gate.
- `git diff --check` passed.
- `AFTERIMAGE_BUILD_DIR=.next-production npm run build -- --webpack` passed, including its mandatory Subjects and font-metrics prebuild checks.
- Fresh audit of all 25 Next output traces found no private artifacts, data, assistant runtime or environment files. Dynamic Subjects traces include every required presentation source, including the new search module.
- The local production server passed authentication checks (Subjects redirects to login; unauthenticated PDF proxy returns 401), authenticated catalog and mechanism rendering for T5, ResNet and Decision Transformer, and production 404 enforcement for the development mechanism-review route. The check used an ephemeral local key and did not access production storage.

## Publication gate

Both independent reviewers completed the final presentation review required by `AGENTS.md`: 268 native browser frames covering all 67 beats, plus 212 adjacent transitions, across 1440px/900px in Light/Dark. The strict report validator checked full state coverage, PNG hashes, actual browser font/geometry facts and exact source/presentation bindings before recording all fourteen renewed visual acceptances. Scientific content, parent digests, renderer digest and source approvals remain unchanged. Private PNGs and browser audit reports stay ignored under `.artifacts/subjects/`.

`npm run subjects:verify` passes with 100 lessons, 203 figures, fourteen mechanisms and no issues. The final presentation digest is `2828755f26186c362b472c57f40f21347b625cb770afe4357a7b98e6ab69bfdf`.

Deployment is assigned to a separate local task. This is a web-only release: retain macserver storage and the existing Cloudflare Access credentials and signed bridge transport. No worker/bridge update or data migration is needed. Preserve the lockfile and exact reviewed font bytes during the normal `npm ci` / webpack production build. Live original-paper fetching and downloading require a post-deployment check because the cloud verification environment could not fetch the remote PDF.
