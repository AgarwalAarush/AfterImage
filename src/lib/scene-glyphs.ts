import { z } from "zod";

const base = { id: z.string().regex(/^[a-z0-9-]+$/).max(24), label: z.string().min(1).max(22), detail: z.string().max(52) };
const items = z.array(z.string().min(1).max(8));
export const glyphSchema = z.discriminatedUnion("glyph", [
  z.object({ ...base, glyph: z.literal("module") }),
  z.object({ ...base, glyph: z.literal("vector"), values: items.min(1).max(4) }),
  z.object({ ...base, glyph: z.literal("tokens"), items: items.min(2).max(6) }),
  z.object({ ...base, glyph: z.literal("bank"), capacity: z.number().int().min(1).max(6), items: items.max(6) }),
  z.object({ ...base, glyph: z.literal("gaussian"), mean: z.number().finite().min(-1e6).max(1e6), deviation: z.number().finite().positive().max(1e6), sample: z.number().finite().min(-1e6).max(1e6).nullable() }),
  z.object({ ...base, glyph: z.literal("gauge"), value: z.number().finite().min(0).max(1), inverse: z.boolean() }),
]);
export type Glyph = z.infer<typeof glyphSchema>;
export type GlyphEdge = { from: string; to: string; label: string; dashed: boolean };

export function glyphRanks(nodes: Glyph[], edges: GlyphEdge[]) {
  const ids = new Set(nodes.map(node => node.id));
  if (ids.size !== nodes.length || edges.some(edge => !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to))
    throw new Error("Schematic has duplicate identifiers or an invalid relationship.");
  if (nodes.some(node => !edges.some(edge => edge.from === node.id || edge.to === node.id))) throw new Error("Schematic objects must participate in a relationship.");
  if (new Set(edges.map(edge => `${edge.from},${edge.to}`)).size !== edges.length) throw new Error("Duplicate schematic relationship.");
  const ranks = new Map<string, number>(), remaining = [...nodes];
  while (remaining.length) {
    const index = remaining.findIndex(node => edges.filter(edge => edge.to === node.id).every(edge => ranks.has(edge.from)));
    if (index === -1) throw new Error("Schematic dependencies must be acyclic; use a flow graph for feedback.");
    const node = remaining.splice(index, 1)[0];
    ranks.set(node.id, Math.max(0, ...edges.filter(edge => edge.to === node.id).map(edge => ranks.get(edge.from)! + 1)));
  }
  if (Math.max(...ranks.values()) > 3 || [...ranks.values()].some(rank => [...ranks.values()].filter(value => value === rank).length > 2))
    throw new Error("Schematic supports four dependency layers and two objects per layer.");
  return ranks;
}

export function validateGlyph(glyph: Glyph) {
  if ((glyph.glyph === "tokens" || glyph.glyph === "bank") && glyph.items.some(item => item.length > 4)) throw new Error("Object identities must be short (at most four characters).");
  if (glyph.glyph === "bank" && glyph.items.length > glyph.capacity) throw new Error("Schematic bank exceeds its declared capacity.");
  if (glyph.glyph === "gauge" && glyph.inverse && (!glyph.value || !Number.isFinite(1 / glyph.value))) throw new Error("An inverse gauge needs a positive denominator.");
  if (glyph.glyph === "gaussian" && glyph.sample !== null && Math.abs(glyph.sample - glyph.mean) > 3 * glyph.deviation)
    throw new Error("Gaussian sample lies outside the displayed three-deviation range.");
}

export const glyphLabels = (glyph: Glyph) => [glyph.label, glyph.detail, ...(glyph.glyph === "vector" ? glyph.values : glyph.glyph === "tokens" || glyph.glyph === "bank" ? glyph.items : [])];
export const glyphNumbers = (glyph: Glyph): number[] => glyph.glyph === "gaussian" ? [glyph.mean, glyph.deviation, ...(glyph.sample === null ? [] : [glyph.sample])]
  : glyph.glyph === "gauge" ? [glyph.value] : glyph.glyph === "bank" ? [glyph.capacity] : [];
