# Article title typography

Paper titles now use the existing self-hosted Overused Grotesk variable font at weight 550 instead of Newsreader. The reader title is 42px with 1.16 line height and -0.025em tracking; existing narrow-screen sizing remains. Discovery, library, recall and related-paper titles share the font and weight, with their existing size roles, 1.22 line height and -0.02em tracking. Balanced wrapping avoids short trailing lines; overflow wrapping handles unusually long unbroken titles.

This is a presentation-only web change in the existing typography owner, `src/app/globals.css`. Reader prose, equations, section headings, diagrams, exports and stored paper content retain their current styling and semantics. It reuses the already-loaded font asset and requires no worker release, storage migration or regeneration.

The home-page follow-up applies the same face, 550 weight, balanced wrapping and tracking to its headline, Next reads and Recall section titles, and empty-state headings through `src/app/ui.css`. Existing size roles remain: 44px headline, 30px section titles and 28px recommendation titles. Recommendation line height is explicitly 1.22 so its more specific legacy rule cannot retain 1.15. Reader prose and other pages' section headings keep their existing roles.

Validation: production build and desktop typography previews in light/dark appearance, including the supplied Expert Choice title, long titles, card widths and constrained reader widths. This note describes the local change; production deployment is separate.
