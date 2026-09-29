# Paper preparation feedback

Adding a paper starts one reader-facing preparation flow backed by two dependent worker jobs. The notecard runs first; only after it passes does the completion route automatically queue the visual study guide and quiz. The paper page polls its authenticated state while either job is active.

Generated content is atomic in the UI. The notecard, opening diagram, study figures, and quiz remain hidden until the full package is ready. During that time the page shows the paper metadata plus one preparation surface instead of separate notecard and study-guide placeholders. Editorial starter papers remain available without requiring a generated study package.

The Mac server worker reports evidence, planning, drafting, and review milestones through its leased heartbeat. The study job adds the final visual-guide-and-quiz stage. The Libraries.dev `thinking-orbs` component maps those real states to `searching`, `shaping`, `composing`, `solving`, and `weaving`; queued work uses its `working` state. The live canvas is rendered directly beside the active preparation copy, without a decorative badge around it. It is removed for idle, ready, and failed states so motion always means the worker is actually active. The package handles reduced motion, hidden tabs, and offscreen pausing.

Failures preserve raw diagnostics privately and show one calm package-level recovery action. A notecard failure retries generation from the original sources; a study failure retries only the dependent study job. No unfinished generated content is published.
