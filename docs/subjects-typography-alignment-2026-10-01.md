# Subjects and Library typography

Subjects lesson identities now use the same selectors as paper identities in the Library. This removes a separate serif title treatment and independent title breakpoints that drifted from the paper reader.

| Before | After | Why |
| --- | --- | --- |
| Subjects article titles used Newsreader at 44px/1.08 with separate 40px and 36px overrides. | Subjects and paper titles share Overused Grotesk, weight 550, 42px/1.16, tracking −0.025em, balanced wrapping, and the existing 33px breakpoint. | Paper and lesson identities belong to the same reading interface. |
| Subjects shelf titles had a separate serif shorthand. | Shelf titles inherit the Library identity face, weight, wrapping and 1.22 line height, at the Library's 25px size. | The shelf and article now introduce the same identity consistently. |
| Reading prose already used the paper reader's Newsreader variables. | Reading prose retains its existing 16px/1.85 desktop scale and section-heading treatment. | Preserve the established reading rhythm and mathematics. |

The shared identity declarations remain in `src/app/globals.css`; shelf composition and sizing remain in `src/app/ui.css`. No lesson science, mechanism geometry, storage, or worker behavior changes.

## Review and release

The appearance fingerprint includes these styles, so old diagram approvals cannot authorize this release. Source bindings and semantic digests remain fixed; all fourteen mechanism sidecars require renewed independent visual acceptance against the current presentation.

Private capture batches can now be selected explicitly when processing screenshots, retaining earlier evidence. The native capture helper uses current DOM/accessibility observations after interaction, pauses autoplay, brings step controls into the native viewport, and saves pixels only when the measured card and geometry survive capture unchanged. A first snapshot that reflows the scrollbar gutter is discarded and retried once using fresh geometry measurements. The requested beat, paused player, object identities/statuses, ordered entities, and active relationships are immutable throughout both attempts. Semantic drift fails immediately rather than becoming a new retry baseline. A changed theme, width, invalid geometry, or a second unstable capture also fails. Four targeted regressions cover first-attempt semantic drift, drift after a geometry retry, and successful geometry-only retries. Captures and criticism stay private and are excluded from deployment bundles.

Validation passes 222 tests, typecheck, the webpack production build, and publication inventory checks: 100 lessons, 203 figures, fourteen current approved walkthroughs, zero findings. Independent reviewers inspected 268 fresh states and 212 adjacent pairs across both desktop widths in Light/Dark. Every scientific scene and source binding is unchanged; only the appearance approval fields differ. The ordinary local NeRF reader and the live Library LoRA reader both resolve their titles to Overused Grotesk, 550, 42px/48.72px, −1.05px tracking, and balanced wrapping. Production deployment and live verification are recorded below after release.

Independent pixel criticism rejected two initial YOLO wide-Light captures: native offscreen SVG compositing enlarged one panel across neighboring panels despite valid DOM measurements. Those rejected images remain private. Capture now returns to the walkthrough heading and discards a full-page repaint snapshot before retaining the next snapshot; both snapshots must preserve the original paused scientific state. DOM bounds alone cannot establish visual acceptance, so replacement pixels still require independent criticism.

## Production verification

Revision `8d16506` is deployed as `dpl_AFSN7zfVUCV6KQNCvWVr5Hv9LuM4`. Fresh Vercel inspection confirms Ready, production target, and the `afterimage.aarushagarwal.dev` alias. Live NeRF and Library LoRA article titles have identical computed identity styles; Subjects and Library shelf titles both resolve to Overused Grotesk, weight 550, 25px/30.5px, and −0.5px tracking. A desktop screenshot of the live NeRF page is retained privately with the review batch.

A subsequent fresh navigation unexpectedly served the prior serif title even though deployment inspection listed the custom alias on the new release. Explicitly assigning the existing production domain to the reviewed deployment restored the expected sans title and shelf styles on fresh navigations. Further checks exposed a concurrent production migration: the storage migration task had promoted its Cloudflare-compatible release to recover Library after this typography-only release replaced it. Ready status and a listed alias alone were insufficient release evidence; both live presentation and authenticated storage reads must pass against one compatible release.

Anonymous review routes return 404; state and Documents APIs return 401. All 23 inspected deployment traces exclude private captures, data, runtime artifacts, and environment files. Subjects route bundles contain all 100 lessons, fourteen sidecars, and the complete presentation fingerprint inputs.

The first live Library check encountered a storage connection failure. Both pinned public Funnel relay probes returned unsigned HTTP 401 and the localhost bridge also returned 401. Library and Documents briefly loaded seven papers and five documents on the migration task's compatible release. On the typography-only release, filtered diagnostics instead reported upstream HTTP 403 without transport error codes: the release lacks the concurrently deployed Cloudflare Access client headers. Funnel probes therefore did not test the active production storage path. This task changed no Funnel routes, database, credentials, bridge, or worker processes. The migration task has cherry-picked the typography change as `768c88b` into its compatible branch; combined production verification remains necessary.
