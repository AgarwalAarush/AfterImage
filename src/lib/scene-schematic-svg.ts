import type { IllustrationPanel } from "./scene-illustration";
import { glyphRanks } from "./scene-glyphs";
import { glyphSvg } from "./scene-glyph-svg";
import { routePlacedEdges, wrapDiagramText } from "./scene-layout";
import { diagramText, escapeXml } from "./scene";
import type { Scene } from "./types";

/** Reading order follows dependencies; branches recompose in dependency layers on phones. */
export function schematicSvg(panel: Extract<IllustrationPanel, { kind: "schematic" }>, width: number, accent: string, marker: string, prefix: string) {
  const ranks = glyphRanks(panel.nodes, panel.edges), levels = Math.max(...ranks.values()) + 1, mobile = width < 600;
  const groups = Array.from({ length: levels }, (_, rank) => panel.nodes.filter(node => ranks.get(node.id) === rank));
  const nodeW = mobile ? (groups.some(group => group.length === 2) ? 120 : 240) : Math.min(200, Math.floor((width - 80 - (levels - 1) * 60) / levels / 10) * 10);
  const height = mobile ? 100 + levels * 320 : groups.some(group => group.length === 2) ? 720 : 420;
  const nodes = panel.nodes.map(node => {
    const rank = ranks.get(node.id)!, group = groups[rank], index = group.indexOf(node);
    const x = mobile ? Math.round((group.length === 1 ? (width - nodeW) / 2 : 30 + index * 150) / 10) * 10
      : 40 + rank * (nodeW + Math.floor((width - 80 - levels * nodeW) / Math.max(1, levels - 1) / 10) * 10);
    const y = mobile ? 100 + rank * 320 : group.length === 2 ? 100 + index * 300 : height / 2 - 130;
    return { ...node, x, y, w: nodeW, h: 280, kind: "box" as const, emphasis: false };
  });
  const routingScene: Scene = { title: panel.title, description: panel.caption, footnote: "", nodes, edges: panel.edges };
  const edges = routePlacedEdges(routingScene, nodes, Math.ceil(width / 10) * 10, height, "glyph");
  let svg = "";
  for (const edge of edges) {
    const d = edge.points.map((point, i) => `${i ? "L" : "M"}${point.x} ${point.y}`).join(" ");
    svg += `<path d="${d}" fill="none" stroke="white" stroke-width="5"/><path data-connector="true" data-from="${prefix}-${edge.from}" data-to="${prefix}-${edge.to}" d="${d}" fill="none" stroke="${accent}" stroke-width="1.6" marker-end="url(#${marker})" ${edge.dashed ? 'stroke-dasharray="4 5"' : ""}/>`;
  }
  for (const node of nodes) {
    svg += `<g data-concept="${prefix}-${node.id}" data-node-bounds="${node.x},${node.y},${node.w},${node.h}">${glyphSvg(node, node.x, node.y, node.w, accent)}</g>`;
  }
  let y = height;
  for (const edge of panel.edges.filter(edge => edge.label)) {
    const from = panel.nodes.find(node => node.id === edge.from)!.label, to = panel.nodes.find(node => node.id === edge.to)!.label;
    const lines = wrapDiagramText(`${from} → ${to}: ${edge.label}`, Math.floor(width / 8.4));
    svg += lines.map((line, i) => `<text x="12" y="${y + i * 20}" font-family="IBM Plex Mono, monospace" font-size="14" fill="#62675f">${diagramText(line)}</text>`).join("");
    y += lines.length * 20 + 12;
  }
  return { svg: `<g aria-label="${escapeXml(panel.title)}">${svg}</g>`, height: y + 12 };
}
