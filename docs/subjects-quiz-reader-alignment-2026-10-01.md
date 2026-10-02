# Subjects quiz and reader cleanup

Subjects and Library quizzes now use the same `ReaderQuiz` component and the existing paper quiz styles. This keeps question typography, answer-row spacing, feedback and navigation in sync instead of maintaining a second quiz design.

| Before | After | Why |
| --- | --- | --- |
| Every Subjects question appeared in one long stack, with fieldset padding separating its legend from the options. | One question at a time in the Library's existing quiz panel, with its question counter and Previous/Next controls. | Match the established reading interface and keep the question next to its answers. |
| Every option expanded into an explanation after checking. | The Library's focused feedback block explains the selected answer and, when needed, the correct answer. | Keep the distinction easy to read without expanding every row. |
| A progress notice, provenance footer and expandable claim inventory occupied the reading interface. | Remove those visible elements and the matching export footer; preserve progress saving, research links and validated source/claim ledgers. | Give the lesson and research room without showing internal audit machinery. |

Both readers retain their existing browser-local progress keys. Question text, answers, explanations, scientific claims and source bindings are unchanged. The shared component retains native radio groups, disabled checked answers, status feedback, retry and the Library's completion score. Invalid saved selections cannot masquerade as checked answers. This is a web-only release; storage, bridge and workers remain unchanged.

`reader-quiz.tsx` is part of the Subjects presentation fingerprint. All fourteen sidecars require new exact-presentation desktop visual acceptance before publication, despite unchanged scientific content. Private screenshots and audits remain excluded from deployment and output traces. The current Cloudflare-capable storage client must remain in the release.

Local validation passes: all 228 tests, typecheck, the production webpack build, and the complete publication inventory (100 lessons, 203 figures and 14 approved mechanisms). Renewed independent acceptance covers 268 states and 212 adjacent transitions at 1440px/900px in Light/Dark. All lesson bytes and scientific scene fields are unchanged. Native quiz checks cover selection, feedback, retry, navigation, heading focus and persisted selections; formula-rich questions render without KaTeX errors.

Full-page browser capture distortion was rejected rather than treated as a layout approval. The final YOLO narrow-Light state uses an explicitly labeled continuous card assembled from three actual native viewport screenshots. Independent review verified every measured pixel band and complete row coverage against the preserved native sources under the unchanged complete-diagram gate. Private capture receipts, rejected images and audits remain excluded from publication.

All 23 fresh output traces exclude private artifacts, storage, assistant runtime and environment files. The three Subjects traces that need presentation fingerprints include the shared quiz source. Production release retains the existing Cloudflare Access-capable storage client and configured server-only Access pair, with no worker, bridge, storage or infrastructure changes.

The local production server rejects anonymous state/document requests with HTTP 401 and disables both development review routes with HTTP 404.

Production release `dpl_Cgzjq2eBDf5rA3CQoNn5LPL2ojhe` is Ready and aliased to `afterimage.aarushagarwal.dev`. It was deployed from clean commit `89027a65b2347f0e6485cdf805aeff2baaf04d41` using the committed install/build commands. Authenticated browser verification on the live NeRF lesson confirms one shared quiz fieldset, working Next/Previous navigation with heading focus, no removed notices and no KaTeX errors. Library and Documents finish loading their existing records. Deployment-scoped runtime counts show successful HTTP 200 state, document, worker and assistant requests; these are availability checks, not a new generation or worker release. Anonymous live state requests return 401 and the development review route returns 404. The actual live quiz screenshot stays private at `.artifacts/subjects/quiz-review/quiz-live.jpg`. Temporary appearance and viewport overrides were restored.
