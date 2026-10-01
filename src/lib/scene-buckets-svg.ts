import type { IllustrationPanel } from "./scene-illustration";
import { wrapDiagramText } from "./scene-layout";
import { diagramText } from "./scene";

/** Token identity and bucket occupancy, rather than abstract boxes, explain allocation. */
export function bucketRoutingSvg(panel: Extract<IllustrationPanel, { kind: "routing" }>, width: number, marker: string, prefix: string) {
  const colors = ["#638eae", "#8068be", "#6d927f", "#bc974c", "#b87869", "#8294a5"];
  const text = (x: number, y: number, label: string, size = 12, color = "#34332f", anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono, monospace" font-size="${size}" fill="${color}">${diagramText(label)}</text>`;
  const cx = 34, bankX = Math.max(170, Math.floor(width * .52)), bankW = width - bankX - 8;
  const height = Math.max(panel.left.length * 72, panel.right.length * 140) + 66;
  const tokenY = panel.left.map((_, i) => 62 + i * (height - 108) / Math.max(1, panel.left.length - 1));
  const bankY = panel.right.map((_, i) => 36 + i * (height - 168) / Math.max(1, panel.right.length - 1));
  let svg = `<defs>${colors.map((color, i) => `<marker id="${marker}-${prefix}-object-arrow-${i}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="${color}"/></marker>`).join("")}</defs>` + wrapDiagramText(panel.leftLabel, 9).map((line, i) => text(cx, 12 + i * 14, line, 12, "#62675f")).join("") + text(bankX + bankW / 2, 12, panel.rightLabel, 12, "#62675f");
  for (const link of panel.links) {
    const x1 = 57, x2 = bankX, y1 = tokenY[link.left], y2 = bankY[link.right] + 48;
    const forward = panel.direction === "left-to-right";
    const d = forward ? `M${x1} ${y1} C${(x1 + x2) / 2} ${y1},${(x1 + x2) / 2} ${y2},${x2} ${y2}` : `M${x2} ${y2} C${(x1 + x2) / 2} ${y2},${(x1 + x2) / 2} ${y1},${x1} ${y1}`;
    svg += `<path d="${d}" fill="none" stroke="white" stroke-width="5"/><path data-assignment="${link.left},${link.right}" data-connector="true" d="${d}" fill="none" stroke="${colors[link.right]}" stroke-width="1.6" marker-end="url(#${marker}-${prefix}-object-arrow-${link.right})"/>`;
  }
  panel.left.forEach((label, i) => {
    const selected = panel.links.filter(link => link.left === i);
    svg += `<circle data-token="${i}" cx="${cx}" cy="${tokenY[i]}" r="22" fill="${selected.length ? "#f4f5f7" : "#fafaf9"}" stroke="${selected.length ? "#638eae" : "#cccac5"}" ${!selected.length ? 'stroke-dasharray="3 3"' : ""}/>${text(cx, tokenY[i] + 4, label, 13)}`;
    (panel.counts === "left" || panel.counts === "both" ? selected : []).forEach((link, n) => { svg += `<circle data-compute="${i},${link.right}" cx="${cx + (n - (selected.length - 1) / 2) * 10}" cy="${tokenY[i] + 34}" r="3" fill="${colors[link.right]}"/>`; });
    if (!selected.length && (panel.counts === "left" || panel.counts === "both")) svg += text(cx, tokenY[i] + 39, "0", 13, "#99968f");
  });
  panel.right.forEach((label, i) => {
    const assigned = panel.links.filter(link => link.right === i), color = colors[i], y = bankY[i];
    svg += text(bankX + bankW / 2, y + 4, label, 13, color);
    svg += `<path data-bank="${i}" d="M${bankX} ${y + 18}V${y + 100}H${bankX + bankW}V${y + 18}" fill="${color}08" stroke="${color}" stroke-width="2"/>`;
    const cellW = bankW / Math.min(3, Math.max(1, assigned.length));
    assigned.forEach((link, n) => {
      const px = bankX + (n % 3 + .5) * cellW, py = y + (assigned.length > 3 ? 37 + Math.floor(n / 3) * 38 : 57);
      svg += `<circle data-occupant="${i},${link.left}" cx="${px}" cy="${py}" r="18" fill="${color}20" stroke="${color}"/>${text(px, py + 4, panel.left[link.left], 12)}`;
    });
    if (panel.counts === "right" || panel.counts === "both") svg += text(bankX + bankW / 2, y + 122, `${assigned.length} ${panel.rightCountUnit ? assigned.length === 1 ? panel.rightCountUnit.singular : panel.rightCountUnit.plural : "selected"}`, 13, color);
  });
  if (panel.counts === "left" || panel.counts === "both") svg += text(0, height + 5, `One dot = one ${panel.leftCountUnit?.singular || "selection"}`, 12, "#62675f", "start");
  return { svg: `<g data-object-routing="${prefix}">${svg}</g>`, height: height + 30 };
}
