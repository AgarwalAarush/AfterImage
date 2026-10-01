# Desktop UI refinement

The appearance selector established a compact, neutral control vocabulary. This
pass applies it to the existing desktop application using Impeccable and Quiet
Tech design guidance, with a React best-practices review of the edited components.

## Changes

- One 40px control height, 36px compact height, 8px radius, theme-aware chevrons,
  and a single visible focus outline. Search fields remain transparent inside
  their wells instead of inheriting global input surfaces.
- Library filters use a compact selected surface, announce their pressed state,
  and announce match counts. Sort and reading-status selects use matching styling.
  Empty-search reset uses a close icon instead of an add icon.
- Smaller introductory headings, fewer decorative kickers and gradients, and
  consistent action styling. Read notecard and Prepare reading kit retain the
  production purple surface and lavender text at the owner's request.
  The owner's follow-up restores recommendation
  cards in full: numbered monospaced role labels, original title scale, spacing,
  and full-width purple actions. “Your reading compass” and its star return above
  the home heading. The secondary line under Next reads is removed in both
  starter and personalized states to reduce copy clutter, along with the
  similarly redundant helper sentence under Recall.
- The paper reader omits the boilerplate editorial/generated provenance footer.
  Equation, walkthrough, and figure source links remain, and Markdown exports
  retain provenance metadata. Stored reviews and review gates are unchanged.
- A visible Reading direction link on For you makes the existing settings route
  discoverable. Direction fields use readable text and helper labels; the
  decorative compass illustration is removed.
- Document search has visible focus. Upload, document list, login, command search,
  and assistant controls share the same surfaces and spacing. The assistant input
  has one focus ring, with no extra outline on its textarea.

`src/app/ui.css` is imported after base and appearance styles in the root layout.
The existing renderers still own diagram geometry and the reading text scale.
No new data model, generation, review, persistence, or worker behavior is added.
This requires only a web release; no bridge or worker update is needed.

## Local verification

The follow-up card/compass restoration passes TypeScript and the Webpack production
build. Local browser checks confirm numbered monospaced role labels, the original
28px card titles, and no section subtitles or horizontal overflow at the 1440px
desktop acceptance width and the current 614px comparison pane. The owner's
requested compass label and card numbering intentionally remain.

The 108-test suite, TypeScript, and production build pass. The design detector
reported no findings in the changed UI layer and edited application components.

Browser inspection covered For you, empty/populated Library, Documents, Markdown
reader, Direction, paper reader, login, command palette, and assistant in Light
and Dark. Layout checks at 1440, 1024, and 390px found no horizontal overflow.
Populated library and document views used temporary browser-only API fixtures;
no fixture records were persisted or sent to production. Diagram thumbnails were
inspected after their dynamic renderer loaded.

Interaction checks covered library search, slash-to-focus, filter selection and
reset, title sorting, document search/reset, outline navigation, assistant input
focus and Escape dismissal, and command-palette search and Escape dismissal.
Existing theme persistence/system/cross-tab checks remain covered by the preceding
appearance-control refinement.

The compiled production server was also checked locally in Light and Dark: the
44px page title, 48px search well, 2px focus outline, transparent input, and 8px
select radius retained the intended CSS order. The temporary server was stopped
after acceptance.

A missing local favicon is pre-existing. One earlier hydration diagnostic came
from screenshot automation temporarily hiding carets; final captures preserve
carets rather than changing input inline styles during hydration.

For the owner's production comparison, the ignored local SQLite database now
contains the single reviewed EAGLE-3 record (`2503.01840`) from the existing local
migration archive, including its recall, equations, figures, and quiz. Its visible
content was checked against the production reader. Existing local records were
preserved, no generation jobs were added, and production was read only. The local
paper route was reloaded and verified after insertion; this fixture is not part
of the source catalog or release.
