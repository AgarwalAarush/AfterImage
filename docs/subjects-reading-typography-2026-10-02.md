# Subjects reading typography iteration

The owner found the normal reading font uncomfortable. This local design iteration uses the existing self-hosted Overused Grotesk throughout the Subjects reader, replacing Newsreader in prose, the summary, objectives, and question text. It adds no font assets.

Desktop prose uses 17px type with 1.75 line height, 20px paragraph separation, and a maximum 68ch measure. The summary uses 18px/1.65. Section headings use 25px/1.3 at weight 550. Display equations and diagrams retain the wider article space; KaTeX owns mathematical glyphs. Existing small-screen compatibility is retained.

Lesson content, source bindings, scientific geometry, workers, storage, the rest of the app's typography, and the title-link change remain unchanged. This is a local design draft, not a production release. Changes to `globals.css` invalidate all fourteen Subjects mechanism presentation approvals. Do not rebind or reuse old pixel approval; publication requires renewed independent browser review under the current presentation. The ordinary lesson used for this iteration contains authored interactive experiments and no mechanism sidecar.

Local validation passes TypeScript and the Impeccable typography detector (zero findings). Desktop browser checks on the Diffusion tutorial confirm 17px/29.75px body text, 658px prose measure, 20px paragraph spacing, zero KaTeX errors, no horizontal page overflow, and no console errors in Light and Dark. Body contrast is approximately 10.7:1 in Light and 14.8:1 in Dark. Screenshots remain local at `/private/tmp/afterimage-reading-type-light.jpg` and `/private/tmp/afterimage-reading-type-dark.jpg`. System appearance was restored after inspection.

`npm run subjects:verify` rejects the fourteen stale mechanism presentation approvals as expected. A production build/release is therefore withheld; neither mechanism source approval nor old visual acceptance was changed to bypass this gate. The draft can be reviewed with `npm run dev -- --webpack --port 3021` at `/subjects/tutorial-on-diffusion-models-for-imaging#s1`.
