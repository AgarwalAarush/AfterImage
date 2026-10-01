# Temporal semantics and review

## Storyboard contract

Use a small versioned JSON object (adapt field names to an existing product schema):

```text
version, title, visibleProof, scope, provenance
sources: id, URL, section/figure, supported claims
objects: stable ID, scientific type, label, meaning
connections: stable ID, endpoints, transferred object, role
initialFacts: available/unavailable/verified/candidate facts
beats: ID, input, operation, output, visible change, focus IDs,
       source IDs/location, pedagogical hold duration
finalInvariant, omissions, accessibleDescription
```

Bound strings/cardinalities at generation. Validate unique IDs, references, source membership, allowed types, and finite durations. Reject model-supplied SVG/HTML/CSS/JS/coordinates in hosted products. Version new temporal semantics.

Syntax does not prove probability normalization, accepted-prefix connectivity, count consistency, legal updates, or source support. Highlighting can guide causal attention; it cannot claim to simulate arithmetic or performance it never computes.

## Temporal correctness

Sequential reveals can falsely serialize parallel work. Reveal concurrent groups together or label the sequence as attention guidance. Hold durations serve the reader, not a latency result; no measured time axis without evidence.

Results cannot precede inputs. Preserve persistent context. An unavailable branch retains that label when highlighted. Distinguish exclusive alternatives from simultaneously active operations. Separate training and inference into scenes or explicit phase switches. A training analogy does not support drawing a specific objective or mask.

## Acceptance

Inspect the poster first: can the reader identify the objects and invariant without playing? Then inspect every beat at publication width, checking arrows, identities, symbols, values, units, sources, and phases. For moving objects inspect before/midpoint/after; endpoints miss collisions.

Reuse diagram review: clipping, small text, text/shape/connector collisions, arrow direction, reading order, unsupported claims, misleading emphasis, missing visual mechanism. Check keyboard controls; readable status explains beats without announcing every frame.

Test autoplay when visible, pause during a beat, resume without resetting time, cycle restart, reduced motion at load and when changed, and leaving the tab. Confirm offscreen/hidden playback stops and explicit user pauses remain paused. If additional controls were requested, test their boundaries. Inspect individual beats through authoring tools without adding those controls to the reading surface.

For routing, pin token identities and animate assignments; derive count dots. For matrix computation, fix axes and highlight contributing operands; compute disclosed teaching values. For memory, retain the accumulator while tiles change; show load/update/writeback only within source scope. Choose a new composition when needed; EAGLE's asset is not a universal template.
