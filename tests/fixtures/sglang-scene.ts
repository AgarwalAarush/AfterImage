// Final scene from production job a81dd839, rejected September 16, 2026.
// Keep the original geometry to reproduce the connector/text regression.
export const sglangScene = {
  title: "RadixAttention reuses exact prompt prefixes",
  description: "The tree participates in matching and receives every new token path and KV reference after suffix execution. The frontend language, scheduling, FSM decoding, API speculation, distributed execution, and benchmarks are omitted.",
  footnote: "Exact-prefix reuse avoids repeated KV computation.",
  nodes: [
    { id: "prompt", kind: "stack", x: 25, y: 205, w: 115, h: 62, label: "Full prompt", detail: "Tokens and fork-prefix hints", emphasis: false },
    { id: "tree", kind: "stack", x: 205, y: 75, w: 125, h: 62, label: "Radix tree", detail: "CPU paths reference KV pages", emphasis: true },
    { id: "match", kind: "box", x: 205, y: 205, w: 125, h: 62, label: "Prefix matcher", detail: "Query tree for longest path", emphasis: true },
    { id: "kv", kind: "matrix", x: 385, y: 205, w: 125, h: 62, label: "Matched KV pages", detail: "GPU state for exact prefix", emphasis: true },
    { id: "suffix", kind: "box", x: 565, y: 205, w: 150, h: 62, label: "Suffix execution", detail: "Compute unmatched tokens only", emphasis: false },
    { id: "update", kind: "box", x: 565, y: 310, w: 150, h: 62, label: "Cache insertion", detail: "Add tokens and KV references", emphasis: false },
    { id: "evict", kind: "box", x: 565, y: 75, w: 150, h: 62, label: "LRU eviction", detail: "Remove zero-reference leaves", emphasis: false },
  ],
  edges: [
    { from: "prompt", to: "match", label: "", dashed: false },
    { from: "tree", to: "match", label: "", dashed: false },
    { from: "match", to: "kv", label: "", dashed: false },
    { from: "kv", to: "suffix", label: "", dashed: false },
    { from: "suffix", to: "update", label: "", dashed: false },
    { from: "update", to: "tree", label: "insert path + KV refs", dashed: false },
    { from: "evict", to: "tree", label: "remove leaf", dashed: false },
  ],
};
