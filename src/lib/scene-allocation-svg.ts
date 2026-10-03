import type { IllustrationPanel } from "./scene-illustration";
import { diagramText } from "./scene";
import { wrapDiagramText } from "./scene-layout";

/** Fixed cells expose padding; expert-column regions expose block sparsity. */
export function allocationSvg(panel: Extract<IllustrationPanel, { kind: "allocation" }>, width: number) {
  const colors = ["#638eae", "#8068be", "#6d927f", "#bc974c"];
  const text = (x: number, y: number, value: string, size = 14, anchor = "start", color = "#34332f") =>
    `<text x="${x}" y="${y}" font-family="IBM Plex Mono, monospace" font-size="${size}" text-anchor="${anchor}" fill="${color}">${diagramText(value)}</text>`;
  let svg = text(0, 16, panel.unit, 14, "start", "#62675f"), y = 50;
  const block = (group: number, first: number, x: number, cy: number, w: number, h: number) =>
    `<rect data-allocation-block="${group},${first}" x="${x}" y="${cy}" width="${w}" height="${h}" rx="4" fill="none" stroke="${colors[group]}" stroke-width="1.8"/>`;
  const cell = (group: number, slot: number, x: number, cy: number, w: number, h: number) => {
    const item = panel.groups[group].items[slot], color = colors[group];
    return `<rect data-allocation-cell="${group},${slot}" data-occupied="${!!item}" x="${x}" y="${cy}" width="${w}" height="${h}" rx="3" fill="${item ? color + "20" : "#fafaf9"}" stroke="${item ? color : "#b9b6bd"}" ${item ? "" : 'stroke-dasharray="4 4"'}/>${item ? text(x + w / 2, cy + h / 2 + 5, item, 14, "middle") : ""}`;
  };
  const blockGap = panel.blockSize ? 8 : 0;
  const gapBefore = (slot: number) => panel.blockSize ? Math.floor(slot / panel.blockSize) * blockGap : 0;
  if (panel.arrangement === "lanes") {
    const size = Math.min(60, ...panel.groups.map(group => Math.floor((width - 84 - gapBefore(group.capacity - 1)) / group.capacity)));
    for (const [i, group] of panel.groups.entries()) {
      wrapDiagramText(group.label, 9).forEach((line, n) => { svg += text(0, y + 24 + n * 17, line, 13, "start", colors[i]); });
      for (let slot = 0; slot < group.capacity; slot++) svg += cell(i, slot, 84 + slot * size + gapBefore(slot), y, size - 4, 42);
      if (panel.blockSize) for (let first = 0; first < group.capacity; first += panel.blockSize)
        svg += block(i, first, 82 + first * size + gapBefore(first), y - 3, panel.blockSize * size, 48);
      svg += text(84, y + 66, `${group.items.length} assigned / ${group.capacity} allocated`, 13, "start", colors[i]);
      y += 94;
    }
  } else {
    const left = 84, cw = Math.floor((width - left) / panel.groups.length), rh = 46;
    const labels = panel.groups.map(group => wrapDiagramText(group.label, Math.max(3, Math.floor((cw - 6) / 7.8))));
    const headerH = Math.max(...labels.map(lines => lines.length)) * 17;
    labels.forEach((lines, i) => lines.forEach((line, n) => { svg += text(left + (i + .5) * cw, y + n * 17, line, 13, "middle", colors[i]); }));
    y += headerH + 16;
    for (const [i, group] of panel.groups.entries()) {
      wrapDiagramText(group.label, 9).forEach((line, n) => { svg += text(0, y + 24 + n * 17, line, 13, "start", colors[i]); });
      for (let slot = 0; slot < group.capacity; slot++) svg += cell(i, slot, left + i * cw, y + slot * rh + gapBefore(slot), cw - 5, rh - 5);
      if (panel.blockSize) for (let first = 0; first < group.capacity; first += panel.blockSize)
        svg += block(i, first, left + i * cw - 2, y + first * rh + gapBefore(first) - 2, cw - 1, panel.blockSize * rh - 1);
      y += group.capacity * rh + gapBefore(group.capacity - 1) + 12;
    }
    svg += text(0, y + 10, "Off-region blocks are absent.", 13, "start", "#62675f");
    y += 38;
  }
  const legend = wrapDiagramText("Filled = assigned; dashed = allocated padding.", Math.floor(width / 8.4));
  legend.forEach((line, i) => { svg += text(0, y + i * 20, line, 14, "start", "#62675f"); });
  return { svg, height: y + legend.length * 20 + 12 };
}
