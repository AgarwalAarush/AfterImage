import type { IllustrationPanel } from "./scene-illustration";
import { diagramText } from "./diagram-text";
import { wrapDiagramText } from "./scene-layout";

type Routing = Extract<IllustrationPanel, { kind: "routing" }>;
const text = (x: number, y: number, value: string, role: "identity" | "axis" | "count", size = 16, fill = "#34332f", anchor = "start") =>
  `<text data-text-role="${role}" x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono, monospace" font-size="${size}" fill="${fill}">${diagramText(value)}</text>`;

/** Versioned assignment diagrams keep their identities readable at publication width. */
export function readableRoutingSvg(panel: Routing, width: number, accent: string, marker: string, panelId: string) {
  const boxW = Math.min(180, Math.floor(width * .32));
  const labelLimit = Math.max(2, Math.floor((boxW - 16) / 9.6));
  const labelLines = { left: panel.left.map(label => wrapDiagramText(label, labelLimit)), right: panel.right.map(label => wrapDiagramText(label, labelLimit)) };
  const boxH = Math.max(54, 24 + 22 * Math.max(...[...labelLines.left, ...labelLines.right].map(lines => lines.length)));
  const axisLimit = Math.max(2, Math.floor((width / 2 - 16) / 9.6));
  const axes = { left: wrapDiagramText(panel.leftLabel, axisLimit), right: wrapDiagramText(panel.rightLabel, axisLimit) };
  const rightX = width - boxW;
  let svg = "";
  for (const side of ["left", "right"] as const) axes[side].forEach((line, i) => {
    svg += text(side === "left" ? 0 : width, 22 + i * 22, line, "axis", 16, "#62675f", side === "left" ? "start" : "end");
  });
  const top = 22 * Math.max(axes.left.length, axes.right.length) + 20;
  const countLines = (side: "left" | "right", index: number) => {
    if (panel.counts !== side && panel.counts !== "both") return [];
    const count = panel.links.filter(link => link[side] === index).length;
    const unit = side === "left" ? panel.leftCountUnit : panel.rightCountUnit;
    const label = `${count} ${unit ? count === 1 ? unit.singular : unit.plural : count === 1 ? "link" : "links"}`;
    return wrapDiagramText(label, Math.max(2, Math.floor((boxW - 8) / 8.4)));
  };
  const counts = { left: panel.left.map((_, i) => countLines("left", i)), right: panel.right.map((_, i) => countLines("right", i)) };
  const countH = 20 * Math.max(0, ...[...counts.left, ...counts.right].map(lines => lines.length));
  const gap = boxH + countH + 24;
  for (const link of panel.links) {
    const fromLeft = panel.direction === "left-to-right";
    const x1 = fromLeft ? boxW : rightX, x2 = fromLeft ? rightX : boxW;
    const y1 = top + (fromLeft ? link.left : link.right) * gap + boxH / 2;
    const y2 = top + (fromLeft ? link.right : link.left) * gap + boxH / 2;
    const d = `M${x1} ${y1} C${width / 2} ${y1},${width / 2} ${y2},${x2} ${y2}`;
    const leftId = `${panelId}-left-${link.left}`, rightId = `${panelId}-right-${link.right}`;
    svg += `<path d="${d}" fill="none" stroke="white" stroke-width="5"/><path data-assignment="${link.left},${link.right}" data-connector="true" data-from="${fromLeft ? leftId : rightId}" data-to="${fromLeft ? rightId : leftId}" d="${d}" fill="none" stroke="${accent}" stroke-opacity=".8" stroke-width="1.5" marker-end="url(#${marker})"/>`;
  }
  for (const side of ["left", "right"] as const) panel[side].forEach((_, i) => {
    const x = side === "left" ? 0 : rightX, y = top + i * gap;
    const count = panel.links.filter(link => link[side] === i).length;
    svg += `<rect data-concept="${panelId}-${side}-${i}" data-node-bounds="${x},${y},${boxW},${boxH}" x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="5" fill="${count > 1 ? accent + "15" : "#fafaf9"}" stroke="${count > 1 ? accent : "#d6d4da"}" ${!count ? 'stroke-dasharray="3 3"' : ""}/>`;
    labelLines[side][i].forEach((line, row) => {
      svg += text(x + boxW / 2, y + boxH / 2 + 5 + (row - (labelLines[side][i].length - 1) / 2) * 22, line, "identity", 16, "#34332f", "middle");
    });
    counts[side][i].forEach((line, row) => {
      svg += text(x + boxW / 2, y + boxH + 18 + row * 20, line, "count", 14, "#62675f", "middle");
    });
  });
  return { svg, height: top + (Math.max(panel.left.length, panel.right.length) - 1) * gap + boxH + countH + 22 };
}
