# AfterImage design reference

Captured 2026-09-12. This is a project design brief, not an update to global skills or memories.

## Evidence and boundaries

- Live desktop and mobile inspection: https://fanout.sh/daily/2026-09-13-lottery-ticket-hypothesis
- Live desktop and mobile inspection: https://fanout.sh/labs
- User's supplied close-up of the Find a Lab panel.
- Earlier Mamba, CLIP, and GPT-3 screenshots and the source findings in the referenced Codex task.
- Read skills: `quiet-tech-design`, its design-language and paper-reading references, and `website-design-extraction`.

The live pages were inspected with browser DOM/computed-style reads, screenshots, and a figure-control interaction. The article was publicly readable in this session. No paywall was bypassed. Source assets are retained under `reference/fanout-2026-09-12/` for analysis, outside production assets. Downloaded CSS contains other site rules too; it is evidence, not AfterImage's implementation.

Observed desktop viewport: 1239 × 889 CSS pixels. Observed narrow viewport: 390 × 844. Root font size was 14px, so a measured 64rem shell was 896px, not 1024px. Do not convert rem measurements assuming a 16px root. Screenshots shown during inspection are in the task; no new screenshot files were persisted.

## Observed: typography and page composition

| Role | Source choice | Measured behavior |
|---|---|---|
| Application canvas | `#f7f7f8` | Pale neutral field around white content |
| Primary ink | `#272727` | Strong readable hierarchy without pure black |
| Secondary ink | `#6e6e6e`, `#929292` | Dek, captions, annotations and metadata |
| Borders | `#e8e8ea`, `#c9c9cf` | Quiet separation and stronger diagram outlines |
| Interface typography | Overused Grotesk | Compact controls and navigation |
| Paper typography | Newsreader Variable | Title, introduction, prose and captions |
| Metadata | Departure Mono and IBM Plex Mono | Sparse, small uppercase labels and quantitative text |
| Concept accents | Purple `#6e56cf`, orange `#e8822a`, yellow `#e9b949` | Distinct semantic roles, mostly pale mixed fills |
| Paper shell | White, square edged, no shadow | `width:min(100%,64rem)`, `padding:5rem 4rem 7.5rem` |
| Header/prose measure | 36rem | 504px desktop in observed root scale |
| Figure measure | 56rem | 784px desktop, wider than prose |
| Equation measure | 48rem | 672px desktop |

The title is centered, weight 400, `clamp(2rem,4vw,2.5rem)`, line-height 1.08, tracking -0.025em. It measured 35px / 37.8px desktop. The introduction has a 34rem maximum, 1rem / 1.55, muted ink. Body prose is 1rem / 1.85 with 1.5rem paragraph margins and justification on desktop. Section headings are restrained serif text, 1.05rem / 1.55 at weight 600, separated by 5rem section margins. The first body section begins 4.5rem below the opening material.

The header sequence is citation metadata → title → short dek → original-paper link → small end mark → opening illustration. Figures expand beyond the text column and then return to a narrower caption. Captions use a small mono figure index with serif explanatory text. Inline source links point to a numbered reference list, which then links to specific PDF pages. Selected claims receive a pale yellow inline highlight with very small padding; entire paragraphs are not put into callout boxes.

The observed mobile paper was 350px wide with 49px 21px 70px padding. The opening figure was 322px wide. These are source measurements, not mandatory AfterImage sizes.

## Observed: Find a Lab search panel

The source panel has three rows: label and keyboard hint; full-width search field; filters and match count. It is a centered white surface with 12px radius and low-offset layered shadow. At the observed desktop viewport it measured 784 × 182.5px, with 21px padding. The DOM uses a 56rem maximum and responsive padding.

- Label: IBM Plex Mono, 12px / 18px, muted, uppercase, 0.24px tracking.
- Keyboard hint: IBM Plex Mono, 10px / 15px, uppercase, 0.6px tracking, right aligned. The page advertises `/` to focus. Global shortcut behavior was not independently verified; pressing `/` while the input was focused typed the character normally.
- Field: 54px height, 9px radius, 1px `#e8e8ea` border, 14px / 18px sans text, 0.28px tracking. Search icon is 16px. Left/right insets measured 38.5px / 42px.
- Field depth: four soft exterior shadows plus an inset bottom shadow: `0 18px 7px #8f8f8f03`, `0 10px 6px #8f8f8f0d`, `0 4px 4px #8f8f8f17`, `0 1px 2px #8f8f8f1a`, `inset 0 -5px 5px #a6a6a640`.
- Tabs: 44px minimum hit height, pill silhouette only on the selected tab, `#f4f4f5` active fill, 13px sans labels, 11px mono counts. Count text is less prominent than the category.
- Result count: 10px uppercase mono with `aria-live="polite"` and `aria-atomic="true"`.
- Typing `latency` produced one match. Category totals remained 16 / 14 / 2; the result count separately represented the query result.
- A nonempty search exposes a clear button. Focus has a visible outline in the inspected browser.
- At 390px, the panel is 350px wide. The hint is hidden, filters occupy a full row, and the match count wraps beneath them. Cards stack vertically.

The site's navigation uses a compact header, a muted announcement strip, and lightly raised controls. The labs results use a consistent grid and large clickable cards, with visual material concentrated near each card's upper edge. The source's promotional banner, online badge, large marketing headline, ASCII decoration and footer catalogue are not needed for AfterImage's reading loop.

## Observed: lottery SVGs and interaction

Four article SVG source structures were captured. They preserve native text and group/class names; the standalone files depend on the source CSS and font tokens. Their raw markup lengths matched the browser inventory after saving, and all parsed as XML.

| Figure | viewBox | Construction and purpose |
|---|---|---|
| Opening desktop | 0 0 920 540 | Faint dense network, isometric base, lifted perforated inner plate, emphasized sparse edges, attached weight tags |
| Opening mobile | 0 0 390 520 | Upright ticket, fewer nodes, separated original-value labels; independently composed |
| Initialization comparison | 0 0 730 320 | Fixed nodes/edges, switchable labels and readout; HTML controls outside the SVG |
| Evidence bars | 0 0 960 318 | Shared zero baseline, muted tracks, bars and endpoints, one highlighted row, compact annotations |

Opening desktop groups: `is-dense-mesh`, `is-winning-plate`, `is-sparse-mesh`, `is-weight-tags`. The dense mesh uses 1px faint lines; active edges use 2.2px purple strokes with round caps. The ticket base uses a 7% purple surface mix, and the lifted plate an 18% yellow surface mix with a purple dashed boundary (`5 5`, 1.8px). Weight tags have white fill, orange outlines and 8px mono text. Shadows are simple offset geometry with low-opacity ink, not complex raster effects.

The opening plate has a five-second ease-in-out vertical lift of 7 SVG units. Reduced-motion CSS stops it in a fixed raised position. The lottery-specific desktop/mobile switch is **640px**; it is not the 720px switch previously observed for Mamba. Print CSS chooses the desktop diagram and hides the interaction controls. Reduced motion and print were inspected in CSS, not visually exercised.

The comparison stage uses a desktop grid `minmax(0,1fr) minmax(12rem,.42fr)`, with a diagram and separate readout. Clicking Fresh random initialization changed the displayed numbers, emphasis and result text while preserving the node/edge geometry. A live region announced the result. Below 640px this stage becomes one column. At 390px the opening portrait SVG was visible and the desktop opening SVG was hidden; the bar SVG was also hidden in favor of responsive HTML.

The original-vs-random comparison is a teaching miniature, explicitly distinguished by the page from the paper's actual architecture. AfterImage should retain that distinction for its own diagrams. The percentage labels describe reported experiments; schematic node/edge counts should not be presented as literal percentages. Quantitative charts need explicit units, scale and conditions.

## Interpretation: what makes the references effective

1. The figure is an explanation with a visual hierarchy. Contrast separates the causal subject from background context.
2. Text and diagrams have different useful widths. Shared centerlines maintain coherence.
3. Isometric depth communicates containment and extraction; it is not a universal style applied to every concept.
4. Tiny mono labels create texture at full figure size, but blindly shrinking them would harm recall-card readability.
5. A controlled comparison changes one meaningful variable. The interaction reinforces the claim rather than becoming a simulator.
6. Sparse color, native text and shared geometric primitives make editing and consistency possible.

## Proposed translation to AfterImage

- Retain the paper/ink palette, tactile search field, quiet filter row, serif paper titles and mono metadata.
- Use the search panel on the library view with reading states and topic filters. Home remains focused on two or three next reads.
- Compress the editorial composition into a recall page: metadata, title, one-sentence idea, diagram, short factual recap, limitations, and sources.
- Target about 120–180 words for the generated recap, with detail/source disclosure when wanted. This word budget is a proposal to test, not a user-mandated limit.
- Give each saved paper one main mechanism diagram; use a second figure or two-state interaction only when it materially improves recall.
- Build original diagrams from primary paper evidence. Source assets in this folder are study material, not production artwork.
- Recompose or simplify on mobile; set label sizes from the final rendered size, not only SVG coordinates.
- Preserve keyboard use, focus, accessible labels, reduced motion and return-to-library state. Do not carry over decorative live counters, sales UI or a feed of endless recommendations.

## Unknown or intentionally unclaimed

The source does not establish whether the author used AI to create the SVGs or whether an automatic generation system exists. All content correctness must be verified against primary papers when creating AfterImage cards. Font licensing and provider/account availability will be checked during implementation. We have not benchmarked the future generator, implemented the product, or deployed the domain.

## Additional reference: gradient-descent lab

Source: https://fanout.sh/labs/gradient-descent . Inspected live on 2026-09-12 at 1488 × 889 and 390 × 844, including computed styles, screenshots and a keyboard slider change. This extends the card and workspace vocabulary; it does not add a simulator feature to AfterImage's scope.

### Observed composition

The page leads with an understated back link, mono eyebrow, left-aligned sans headline and short supporting explanation. A small equation sits at the right edge of the desktop header. A centered label between two faint wavy SVG lines introduces the working area. The divider is 420px wide with a 100% maximum, 10px gaps and 8px-high strokes.

The article is 80rem maximum (1120px at the observed 14px root), with 21px horizontal padding. Its usable desktop content width is 1078px. The 42px headline uses 44.1px line height and -1.05px tracking.

The working area has a deliberate hierarchy:

1. Full-width primary visual card, with mono icon/label, a 26.25px outcome-oriented heading, a quiet status pill and a large diagram.
2. A pair of supporting cards in a `0.82fr 1.18fr` desktop grid: controls on the left, tabular evidence on the right. Shared height and aligned edges make these read as one supporting row.
3. A full-width result strip, with four metrics separated by fine dividers rather than four individual cards.
4. A quiet method section and source link following another labeled divider.

Main and supporting cards share 12px corners, 24.5px desktop padding, 17.5px gaps and the same layered low-contrast shadow already captured in the Labs search panel. There is no prominent border. The cards express different roles through proportions and content, not unrelated styling.

The main visual card has a **145-degree gradient from a 10% yellow/surface mix to white at 54%**. This is an intentional counterexample to a blanket no-gradients rule. AfterImage may use a similarly faint, concept-associated tint on its main diagram surface. Avoid spreading decorative gradients across every card.

### Observed control and evidence treatment

The controls pair short labels and muted helper text with tactile slider rails and separate mono value capsules. The rails have closely spaced vertical ticks, a stronger position marker and low-contrast depth. Native range inputs retain the actual interaction and accessible values; ornamental ticks are hidden from accessibility. At desktop size, numeric outputs are 73.5px wide, 49px high, with 24px radius, a 1px border and subtle shadow. Values use tabular mono numerals.

Changing the learning-rate slider with ArrowRight moved it from 0.20 to 0.25. The SVG's accessible ending value, trace rows and final metrics updated. The observed final x changed from 1.9869 to 1.9985. This verifies a connected interaction rather than a static control illustration; it does not establish the implementation's network/privacy claims.

The evidence table uses small uppercase mono headers, right-sized numeric columns, faint row rules, a bounded scroll region and a sticky header. Supporting labels remain subordinate to the visual result. The bottom metrics live in one shared definition-list surface with four desktop columns.

The main chart is a 760 × 340 SVG: a neutral continuous curve, accent dashed update path, small step dots, a larger final point and sparse labels. The figure makes progression salient without coloring every element.

### Observed mobile and proposed adaptation

At 390px, cards are 350px wide with 17.5px padding. The supporting pair stacks vertically; control labels move above their rails and values. The result strip becomes a vertical list. The chart keeps a **680px minimum width inside a 315px horizontally scrollable region**. Unlike the earlier lottery opening, this chart is not recomposed for mobile.

For AfterImage, retain the stacked cards and tactile controls where appropriate, but prefer a readable full-concept mobile diagram for quick recall. Horizontal scrolling should be reserved for figures whose real complexity requires it.

### Proposed AfterImage card hierarchy

- Main recall surface: small subject label, one-sentence mechanism, generous original SVG, restrained semantic tint when useful.
- Supporting row: concise mechanism, evidence, and limitation, with widths chosen for content. Avoid fragmenting every factual field into its own card.
- One quiet metadata/action strip for reading status, review date and source navigation when relevant. Do not invent dashboard metrics to fill the source layout.
- Shared 12px-ish corners, padding scale, shadows and label styles across cards; deliberate variation in card size.
- Keep the serif title and reading typography from the paper reference, with sans/mono controls and labels from the lab. The two modes form one coherent visual system.

This reference makes card composition and tactile detail explicit acceptance criteria alongside typography and SVG quality. The outcome should feel carefully assembled at the page level, not merely like individually attractive components.
