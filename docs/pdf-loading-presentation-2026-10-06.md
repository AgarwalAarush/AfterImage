# Original-paper loading presentation

The original-paper reader previously displayed plain “Opening paper…” and “Loading original paper…” paragraphs while loading its client module and fetching the PDF. Unrendered pages displayed only their page number.

Both initial loading phases now show the same quiet, monochrome dotted orb inside a faint paper outline. The Lesson/Analysis and Paper switch remains available during the lazy module load. The installed `thinking-orbs` 0.3.1 package supplies the orb; its existing theme detection, reduced-motion still frame, offscreen suspension and hidden-tab suspension apply. No dependency or lockfile update is needed.

Pages retain their measured dimensions while rendering. A static paper outline and light-surface orb replace the page-number placeholder; the completed canvas fades in over 160 ms. The selectable text stays hidden until its corresponding canvas and text layer have both finished. Reduced motion removes this fade. Loading has a screen-reader status, and incomplete pages expose `aria-busy`; visible error/retry, citation location and find statuses remain available.

There is no artificial wait, progress percentage, generated content or backend change. PDF.js remains lazily imported and fetches the same authenticated PDF endpoint. The shared loading component is included in Subjects presentation fingerprints and runtime source traces. Scientific content, parent digests, renderer geometry, stored state and font/dependency bytes are preserved.

## Validation

Local browser and engineering results will be recorded after verification. Subjects requires renewed independent visual acceptance for the updated shared presentation before its production publication audit can pass; the earlier selection correction's release gate remains in force. No deployment is included in this request.
