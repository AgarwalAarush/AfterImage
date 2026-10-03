# Paper abstract alignment

Library paper abstracts and reviewed notecard introductions now use left-aligned text inside their existing centered, 68ch reading column. The scoped paragraph style overrides the header's inherited text alignment while retaining its auto margins, typography, and width. Paper titles and header actions retain their centered placement.

This is a Library-only presentation change in `src/components/paper-reading.module.css` and requires a web release.

Validation: eight isolated Chromium layout checks using the repository styles cover 1440px and 900px, Light/Dark, and prepared/unprepared headers. Paragraph text is left-aligned, its bounds match the previous centered layout, titles and actions remain centered, and no horizontal overflow appears. `git diff --check` passes. Integrated build and publication checks are recorded in [reader toggle positioning](reader-toggle-positioning-2026-10-03.md).
