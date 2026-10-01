import { z } from "zod";
import type { Source } from "./types";
import { glyphSchema, glyphRanks, validateGlyph, glyphLabels, glyphNumbers } from "./scene-glyphs";

import { stateTraceSchema, validateStateTrace } from "./scene-state-trace";
import { tokenTreeSchema, validateTokenTree } from "./scene-tree";

const label = z.string().min(1).max(18);
const common = {
  title: z.string().min(1).max(48),
  caption: z.string().min(1).max(160).describe("One or two complete sentences, preferably under 140 characters. Rewrite concisely; never truncate words or sentences."),
  illustrative: z.boolean(),
  sourceIds: z.array(z.string().min(1)).min(1).max(8),
};
const index = z.number().int().min(0).max(5);
const countUnit = z.object({ singular: z.string().min(1).max(14), plural: z.string().min(1).max(14) });
export const illustrationPanelSchema = z.discriminatedUnion("kind", [
  z.object({
    ...common, kind: z.literal("matrix"),
    rowLabel: label, columnLabel: label,
    rows: z.array(label).min(2).max(6), columns: z.array(label).min(2).max(6),
    values: z.array(z.array(z.string().max(8)).min(2).max(6)).min(2).max(6),
    selected: z.array(z.object({ row: index, column: index })).max(36),
    normalization: z.enum(["row-normalized", "none"]).nullish(),
    selectionRule: z.object({ axis: z.enum(["row", "column"]), k: z.number().int().min(1).max(6) }).nullish(),
  }),
  z.object({
    ...common, kind: z.literal("routing"),
    leftLabel: label, rightLabel: label,
    left: z.array(label).min(2).max(6), right: z.array(label).min(2).max(6),
    // Direction describes the selection relationship, not necessarily data movement.
    direction: z.enum(["left-to-right", "right-to-left"]),
    links: z.array(z.object({ left: index, right: index })).min(1).max(18),
    // Counts are derived from links; never supplied independently by the model.
    counts: z.enum(["left", "right", "both", "none"]),
    leftCountUnit: countUnit.nullish(), rightCountUnit: countUnit.nullish(),
    presentation: z.enum(["links", "buckets"]).nullish(),
  }),
  z.object({
    ...common, kind: z.literal("bars"),
    unit: z.string().min(1).max(24),
    items: z.array(z.object({ label, value: z.number().finite().min(0).max(1e9) })).min(2).max(6),
  }),
  z.object({
    ...common, kind: z.literal("schematic"),
    nodes: z.array(glyphSchema).min(2).max(6),
    edges: z.array(z.object({ from: z.string().max(24), to: z.string().max(24), label: z.string().max(36), dashed: z.boolean() })).max(8),
  }),
  z.object({
    ...common, kind: z.literal("allocation"),
    arrangement: z.enum(["lanes", "diagonal"]),
    unit: z.string().min(1).max(24),
    groups: z.array(z.object({
      label,
      capacity: z.number().int().min(1).max(6),
      items: z.array(z.string().min(1).max(4)).max(6),
    })).min(2).max(4),
  }),
  z.object({
    ...common, kind: z.literal("memory"),
    regions: z.array(z.object({
      label,
      objects: z.array(z.object({
        id: z.string().regex(/^[a-z0-9-]+$/).max(24), label,
        shape: z.string().min(1).max(24),
        rows: z.number().int().min(1).max(6), columns: z.number().int().min(1).max(6),
        residency: z.enum(["stored", "transient", "absent"]),
      })).min(1).max(6),
    })).length(2),
    transfers: z.array(z.object({from:z.string().max(24),to:z.string().max(24),label:z.string().min(1).max(36)})).max(12),
    repeat: z.string().max(100).describe("One complete concise sentence, preferably under 80 characters. Rewrite; never truncate words or leave an unfinished clause."),
    coverage: z.object({
      leftLabel:label,rightLabel:label,
      left:z.array(z.string().min(1).max(8)).min(2).max(4),right:z.array(z.string().min(1).max(8)).min(2).max(4),
      order:z.enum(["left-major","right-major"]),
    }).nullish(),
  }),
  tokenTreeSchema.extend({ ...common, kind: z.literal("tree") }),
  stateTraceSchema.extend({ ...common, kind: z.literal("state-trace") }),
]);
export const illustrationSchema = z.object({
  takeaway: z.string().min(1).max(140),
  panels: z.array(illustrationPanelSchema).min(1).max(3),
});
export type Illustration = z.infer<typeof illustrationSchema>;
export type IllustrationPanel = z.infer<typeof illustrationPanelSchema>;

/** Scientific consistency and bounds are checked before any SVG is produced. */
export function validateIllustration(illustration: Illustration) {
  const dimensions=illustration.panels.flatMap(panel=>panel.kind!=="memory"?[]:panel.regions.flatMap(region=>region.objects.flatMap(object=>{
    const match=object.shape.match(/(?:(\d+)\s*[×x]\s*)?N\s*[×x]\s*(N|d)$/);
    if(!match)return [];
    const copies=Number(match[1]||1),columns=object.columns/copies;
    if(!Number.isInteger(columns)||columns<1||match[2]==="N"&&columns!==object.rows)throw new Error("Memory grid dimensions must match symbolic N×N/N×d shapes and multiplicity; use one consistent illustrative N and d, separating combined matrices if needed.");
    return [{n:object.rows,d:match[2]==="d"?columns:null}];
  })));
  if(new Set(dimensions.map(shape=>shape.n)).size>1||new Set(dimensions.flatMap(shape=>shape.d===null?[]:[shape.d])).size>1)throw new Error("Compared memory grids must use the same illustrative N and d for every N×N/N×d object.");
  for (const panel of illustration.panels) {
    const groups = panel.kind === "matrix" ? [panel.rows, panel.columns] : panel.kind === "routing" ? [panel.left, panel.right] : panel.kind === "bars" ? [panel.items.map(item => item.label)] : panel.kind === "allocation" ? [panel.groups.map(group => group.label)] : panel.kind === "memory" ? [panel.regions.map(region=>region.label), ...panel.regions.map(region=>region.objects.map(object=>object.label))] : panel.kind === "state-trace" ? [panel.branches.map(branch=>branch.mode)] : panel.kind === "tree" ? [] : [panel.nodes.map(node => node.label)];
    if (groups.some(group => new Set(group).size !== group.length))
      throw new Error("Illustration labels must be unique within each group.");
    if (panel.kind === "matrix") {
      if (panel.values.length !== panel.rows.length || panel.values.some(row => row.length !== panel.columns.length))
        throw new Error("Matrix values must match the labeled rows and columns.");
      const cells = new Set<string>();
      for (const cell of panel.selected) {
        const key = `${cell.row},${cell.column}`;
        if (cell.row >= panel.rows.length || cell.column >= panel.columns.length || cells.has(key))
          throw new Error("Matrix selection is duplicate or outside the matrix.");
        cells.add(key);
      }
      if (panel.normalization === "row-normalized") {
        if (panel.values.some(row => row.some(value => !Number.isFinite(Number(value)) || !value.trim() || Number(value) < 0) || Math.abs(row.reduce((sum, value) => sum + Number(value), 0) - 1) > .015))
          throw new Error("A row-normalized diagram matrix must contain nonnegative numbers summing to one in every row.");
      }
      if (panel.selectionRule) {
        const { axis, k } = panel.selectionRule, groups = axis === "row" ? panel.rows.length : panel.columns.length;
        for (let group = 0; group < groups; group++) {
          const scores = axis === "row" ? panel.values[group].map(Number) : panel.values.map(row => Number(row[group]));
          const selected = panel.selected.filter(cell => cell[axis] === group).map(cell => axis === "row" ? cell.column : cell.row);
          const chosen = scores.filter((_, i) => selected.includes(i)), other = scores.filter((_, i) => !selected.includes(i));
          if ((axis === "row" ? panel.values[group] : panel.values.map(row => row[group])).some(value => !value.trim()) || scores.some(score => !Number.isFinite(score)) || selected.length !== k || Math.min(...chosen) < Math.max(...other))
            throw new Error("Diagram selections must match the declared top-k axis and scores.");
        }
      }
    }
    if (panel.kind === "routing") {
      if (panel.presentation === "buckets" && panel.left.some(label => label.length > 4)) throw new Error("Bucket routing needs short token identities (at most four characters).");
      const links = new Set<string>();
      for (const link of panel.links) {
        const key = `${link.left},${link.right}`;
        if (link.left >= panel.left.length || link.right >= panel.right.length || links.has(key))
          throw new Error("Routing link is duplicate or outside its labeled groups.");
        links.add(key);
      }
    }
    if (panel.kind === "state-trace") validateStateTrace(panel);
    if (panel.kind === "tree") validateTokenTree(panel);
    if (panel.kind === "schematic") {
      if (panel.nodes.every(node => node.glyph === "module")) throw new Error("Use a flow graph for ordinary compute modules; a schematic needs a data-bearing glyph.");
      glyphRanks(panel.nodes, panel.edges);
      panel.nodes.forEach(validateGlyph);
    }
    if (panel.kind === "allocation") {
      if (!panel.groups.some(group => group.items.length)) throw new Error("Allocation needs at least one assigned object.");
      if (panel.groups.some(group => group.items.length > group.capacity || new Set(group.items).size !== group.items.length))
        throw new Error("Allocation has overflow or duplicate identities within a group.");
    }
    if(panel.kind==="memory"){
      if(panel.coverage&&[panel.coverage.left,panel.coverage.right].some(labels=>new Set(labels).size!==labels.length))throw new Error("Tile coverage identities must be unique within each axis.");
      const objects=panel.regions.flatMap(region=>region.objects), ids=new Set(objects.map(object=>object.id));
      if(ids.size!==objects.length)throw new Error("Memory objects require unique identifiers.");
      const links=new Set<string>();
      for(const transfer of panel.transfers){
        const key=`${transfer.from}:${transfer.to}`;
        if(!ids.has(transfer.from)||!ids.has(transfer.to)||transfer.from===transfer.to||links.has(key))throw new Error("Invalid or duplicate memory transfer.");
        if(objects.some(object=>(object.id===transfer.from||object.id===transfer.to)&&object.residency==="absent"))throw new Error("An absent memory object cannot participate in a transfer.");
        links.add(key);
      }
    }
    if (panel.kind === "bars" && /%|percent/i.test(panel.unit) && panel.items.some(item => item.value > 100))
      throw new Error("Percentage bars must stay in the 0-100 range.");
  }
}

export function illustrationLabels(illustration: Illustration): string[] {
  return [illustration.takeaway, ...illustration.panels.flatMap(panel => [
    panel.title, panel.caption,
    ...(panel.kind === "matrix" ? [panel.rowLabel, panel.columnLabel, ...panel.rows, ...panel.columns, ...panel.values.flat()]
      : panel.kind === "routing" ? [panel.leftLabel, panel.rightLabel, ...panel.left, ...panel.right, ...[panel.leftCountUnit, panel.rightCountUnit].flatMap(unit => unit ? [unit.singular, unit.plural] : [])]
      : panel.kind === "bars" ? [panel.unit, ...panel.items.map(item => item.label)]
      : panel.kind === "allocation" ? [panel.unit, ...panel.groups.flatMap(group => [group.label, ...group.items])]
      : panel.kind === "memory" ? [panel.repeat, ...panel.regions.flatMap(region=>[region.label,...region.objects.flatMap(object=>[object.label,object.shape])]),...panel.transfers.map(transfer=>transfer.label),...(panel.coverage?[panel.coverage.leftLabel,panel.coverage.rightLabel,...panel.coverage.left,...panel.coverage.right]:[])]
      : panel.kind === "state-trace" ? [panel.initial.state,panel.initial.h,panel.initial.z,panel.initial.observation,...panel.branches.flatMap(branch=>[branch.mode,...branch.steps.flatMap(step=>[step.state,step.h,step.z,step.action,step.observation || ""])])]
      : panel.kind === "tree" ? [panel.prefixLabel || "", panel.verificationLabel || "", panel.targetToken || "", ...panel.nodes.map(node => node.token)]
      : [...panel.nodes.flatMap(glyphLabels), ...panel.edges.map(edge => edge.label)]),
  ])];
}

/** Apply the same exact-value provenance rule as quantitative study figures. */
export function validateIllustrationSources(illustration: Illustration, sources: Source[]) {
  const available = new Map(sources.map(source => [source.id, source]));
  for (const panel of illustration.panels) {
    if (panel.sourceIds.some(id => !available.has(id))) throw new Error("Diagram panel cites an unknown source.");
    if (panel.illustrative) continue;
    const values = panel.kind === "bars" ? panel.items.map(item => item.value)
      : panel.kind === "matrix" ? panel.values.flat().filter(value => /^[-+]?\d+(?:\.\d+)?$/.test(value)).map(Number)
      : panel.kind === "schematic" ? panel.nodes.flatMap(glyphNumbers) : panel.kind === "allocation" ? panel.groups.map(group => group.capacity) : [];
    const numbers = panel.sourceIds.flatMap(id => (available.get(id)!.excerpt.match(/[-+]?\d+(?:\.\d+)?/g) || []).map(Number));
    if (values.some(value => !numbers.includes(value)))
      throw new Error("A reported diagram value is absent from its cited sources. Use supported values or an explicitly illustrative example.");
  }
}
