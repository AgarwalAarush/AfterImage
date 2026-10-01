import type { TokenTree } from "./scene-tree";
import { diagramText } from "./scene";
import { wrapDiagramText } from "./scene-layout";

/** Prefix sharing and acceptance are topology, never decorative node counts. */
export function tokenTreeSvg(tree: TokenTree, width: number, prefix: string) {
  const text = (x: number, y: number, value: string, anchor = "start", fill = "#34332f") =>
    `<text x="${x}" y="${y}" font-family="IBM Plex Mono" font-size="14" text-anchor="${anchor}" fill="${fill}">${diagramText(value)}</text>`;
  const root = tree.nodes.find(node => node.parentId === null)!;
  const children = (id: string) => tree.nodes.filter(node => node.parentId === id);
  const leaves = (id: string): number => children(id).length ? children(id).reduce((sum, child) => sum + leaves(child.id), 0) : 1;
  const ordered: { node: TokenTree["nodes"][number]; depth: number }[] = [];
  const visit = (node: TokenTree["nodes"][number], depth: number) => { ordered.push({ node, depth }); children(node.id).forEach(child => visit(child, depth + 1)); };
  visit(root, 0);
  const narrow = width < 400 || leaves(root.id) * 64 > width - 40;
  const heading = tree.verificationLabel ? wrapDiagramText(tree.verificationLabel, Math.floor((width - 32) / 8.4)) : [];
  const frameTop = tree.prefixLabel ? 104 : 10;
  const firstY = frameTop + 46;
  const pos = new Map<string, { x: number; y: number }>();
  if (narrow) {
    ordered.forEach(({ node, depth }, index) => pos.set(node.id, {
      x: 40 + depth * Math.min(52, (width - 80) / 4),
      y: tree.prefixLabel && index === 0 ? 54 : firstY + (index - (tree.prefixLabel ? 1 : 0)) * 80,
    }));
  } else {
    let leafIndex = 0; const total = leaves(root.id), step = (width - 56) / total;
    const place = (node: TokenTree["nodes"][number], depth: number): number => {
      const xs = children(node.id).map(child => place(child, depth + 1));
      const x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : 28 + (leafIndex++ + .5) * step;
      pos.set(node.id, { x, y: tree.prefixLabel && depth === 0 ? 54 : firstY + (depth - (tree.prefixLabel ? 1 : 0)) * 100 });
      return x;
    }; place(root, 0);
  }
  const lastY = Math.max(...Array.from(pos.values(), point => point.y));
  const frameBottom = lastY + 48 + heading.length * 20;
  let svg = "";
  if (tree.prefixLabel) svg += text(16, 18, tree.prefixLabel);
  if (tree.verificationLabel) {
    svg += `<rect x="1" y="${frameTop}" width="${width - 2}" height="${frameBottom - frameTop}" rx="8" fill="#7761bb06" stroke="#7761bb80"/>`;
    heading.forEach((line, index) => svg += text(16, lastY + 48 + index * 20, line, "start", "#62528e"));
  }
  for (const { node } of ordered) if (node.parentId) {
    const a = pos.get(node.parentId)!, b = pos.get(node.id)!;
    const tone = node.status === "accepted" ? "#456e55" : node.status === "rejected" ? "#8d8780" : "#7761bb";
    const d = narrow ? `M${a.x + 22} ${a.y} H${a.x + 26} V${b.y} H${b.x - 22}` : `M${a.x} ${a.y + 22} L${b.x} ${b.y - 22}`;
    svg += `<path data-connector="true" data-from="${prefix}-${node.parentId}" data-to="${prefix}-${node.id}" data-tree-edge="${prefix}-${node.parentId}:${prefix}-${node.id}" d="${d}" stroke="${tone}" stroke-width="${node.status === "accepted" ? 3 : 1.5}" ${node.status === "rejected" ? 'stroke-dasharray="4 4"' : ""} fill="none"/>`;
  }
  for (const { node } of ordered) {
    const point = pos.get(node.id)!, tone = node.status === "accepted" ? "#456e55" : node.status === "rejected" ? "#8d8780" : "#7761bb";
    svg += `<g data-concept="${prefix}-${node.id}" data-node-bounds="${point.x - 22},${point.y - 22},44,44" data-tree-node="${prefix}-${node.id}" data-tree-status="${node.status}"><circle cx="${point.x}" cy="${point.y}" r="22" fill="${node.status === "accepted" ? "#e9f0eb" : "white"}" stroke="${tone}" stroke-width="${node.status === "accepted" ? 2.5 : 1.5}" ${node.status === "rejected" ? 'stroke-dasharray="4 4"' : ""}/>${text(point.x, point.y + 5, node.token, "middle", tone)}</g>`;
  }
  let y = frameBottom + 28;
  if (tree.targetToken) {
    for (const line of wrapDiagramText("Commit matched proposals + target fallback", Math.floor(width / 8.4))) { svg += text(0, y, line); y += 20; }
    const output = ordered.filter(({node}) => node.status === "accepted" && !(tree.prefixLabel && node.id === root.id)).map(({node}) => ({token: node.token, target: false}));
    output.push({token: tree.targetToken, target: true});
    const step = 54, left = (width - output.length * step) / 2; y += 22;
    output.forEach((item, index) => {
      const x = left + 27 + index * step, tone = item.target ? "#316f9d" : "#456e55";
      if(index)svg += `<path d="M${x - step + 22} ${y} H${x - 22}" stroke="#456e55" stroke-width="2.5"/>`;
      svg += `<g data-committed-token="${index}" data-token-role="${item.target ? "target" : "proposal"}"><circle cx="${x}" cy="${y}" r="22" fill="${item.target ? "#e8eff5" : "#e9f0eb"}" stroke="${tone}" stroke-width="2.5"/>${text(x,y+5,item.token,"middle",tone)}</g>`;
    }); y += 54;
  }
  const keys = [tree.nodes.some(node => node.status === "accepted") ? "GREEN = accepted" : "", tree.nodes.some(node => node.status === "candidate") ? "PURPLE = candidate" : "", tree.nodes.some(node => node.status === "rejected") ? "DASHED = rejected" : "", tree.targetToken ? "BLUE = target fallback" : ""].filter(Boolean);
  for (const line of wrapDiagramText(keys.join("; ") + ".", Math.floor(width / 8.4))) { svg += text(0, y, line); y += 20; }
  return { svg, height: y + 12 };
}
