# Library recall width

The recall heading and section containers previously shared a 760px cap, while prose had a second 68ch cap. This left paragraphs narrower than the heading and retained large inner margins when the assistant was closed.

The Library-only `paper-reading.module.css` now gives recall headings, sections, equations, and walkthroughs one shared column. At desktop widths of at least 1000px, the column can grow to 960px while the assistant is closed. Opening the assistant restores the existing 760px cap. Paragraphs fill that column rather than applying a second character-based limit. Available panel space still bounds the column at smaller widths.

This is a web-only presentation change. Existing fonts, panel padding, diagram geometry, stored content, worker behavior, quiz progress, and Subjects presentation sources retain their current owners. The scoped module is inert on Subjects routes, so their publication fingerprints and visual acceptance are unaffected.

Validation: TypeScript and the production webpack build pass. The Subjects publication audit passes with 100 lessons, 203 figures, fourteen mechanisms, and no issues. All 25 build traces exclude private artifact, data, assistant-runtime, and environment files. The layout detector reports no findings.

An isolated seed-library browser check covers 1440px and 900px in Light/Dark, opening and closing the assistant. At 1440px the heading and first paragraph share exactly matching edges and widths: 960px closed, 760px open. At 900px both fit the available 702px column. Prose retains the existing 17px font size, with no horizontal overflow or browser exceptions. Rendered desktop screenshots were inspected. Navigation to Subjects confirms its prose retains the existing 68ch limit without Library-scoped classes. Private screenshots and browser facts remain in ignored `.artifacts/reader-width/`. Production release evidence is recorded separately after deployment.
