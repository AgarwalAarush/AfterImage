# EAGLE-3 explanation review

Reviewed against arXiv 2503.01840 (current HTML v3), sections 2.1, 3.1, 3.2, and Tables 1–3. Original recall backed up privately in `.data/eagle-before-review.json` before a narrow CAS update. Other papers, reading status, recommendations, and jobs were preserved.

The previous figure named stages but obscured what the draft passes forward and mixed training with inference. Its single equation described background speculative acceptance, leaving the actual EAGLE-3 computation unexplained.

Changes:
- Four titled math steps: fusion, first draft, self-fed recurrence/training, and acceptance plus correction. Dimensions, context, symbol roles, and worked examples are explicit. Projection/decoder notation is labeled explanatory shorthand, not a purported verbatim loss formula.
- A worked Figure 5 token trace, with input/operation/output columns on desktop and labeled cards on mobile. Evidence explains how to read speedup versus acceptance length in Table 1.
- An original paired desktop/mobile SVG distinguishes state vectors from sampled tokens and separates target verification from training rehearsal. Caption explicitly scopes the picture to one branch of the actual dynamic tree.
- Shared math captions increased to 18px desktop / 17px mobile; equations 19px / 17px before KaTeX's scale. Math remains lazy-loaded on paper pages.
- Generation prompt and critic now require paper-specific computations, defined transferred objects, training/inference distinctions, and worked explanations where supported. Optional examples and walkthroughs retain math/source validation. Codex's strict output schema uses required nullable additions while stored older recalls remain supported.

Validation: 23 tests pass; production build passes. New tests cover unsafe math and unknown sources in examples/tables, SVG font-outline collisions in both layouts, and backwards-compatible strict output schemas. Browser checks at desktop and mobile sizes found no math fallback or document overflow; live page confirms four math steps, four table rows, and 18px desktop explanations. Mobile table reformats into cards. No new full AI generation was run to claim that the revised rubric guarantees future quality.

Deployment: `afterimage-5pcaoq4lw-aarush-agarwals-projects.vercel.app`, custom domain `afterimage.aarushagarwal.dev`. Updated worker files synchronized to macserver and existing LaunchAgent gracefully restarted; PID 90063 and remote schema import verified.
