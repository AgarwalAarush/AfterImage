# Reader toggle positioning

The Library reader's Notecard/Paper toggle is now Analysis/Paper, with the ready-view breadcrumb using Analysis as well. Subjects retains Lesson/Paper. The toggle occupies the left column of the PDF toolbar, while page navigation, zoom and source actions occupy a separate centered column. Equal outer columns keep the PDF controls centered over the paper pane, independently of the assistant action at the right.

The existing reading navigation and PDF toolbar retain matching left and top insets, so changing views keeps the segmented toggle in position. Narrow reader panes retain local horizontal scrolling for PDF controls. The mounted PDF still preserves its document, search, zoom and scroll state across view changes.

This shared reader presentation change requires a web release and renewed fingerprint-bound Subjects visual acceptance under `AGENTS.md` before production publication.

Validation: TypeScript and all seven existing PDF location/proxy/search tests pass. Native browser checks cover 1440px/900px, Light/Dark, expanded/collapsed navigation, and an open assistant. Switching views preserves the toggle's exact bounds, PDF controls remain centered, the PDF stays mounted with its selected zoom, and no browser errors or page overflow appear. The Subjects Lesson/Paper toggle and assistant action also pass checks at both desktop widths. Existing 375px compatibility retains a stable toggle and locally scrolling PDF controls without page overflow. PDF rendering used a clearly labeled browser-only local fixture; original-paper network fetching was not part of this layout verification.

The Subjects publication audit passed before the shared presentation edits and now flags all fourteen mechanisms as lacking current visual approval. Their scientific content and review records have not been changed. Independent visual acceptance must be renewed before a production build or release; no approval fingerprint was bypassed and no deployment was performed.
