import type { Scene, SceneNode } from "./types";
import { diagramText, escapeXml } from "./scene";

type Point = { x: number; y: number };
type Box = Point & { w: number; h: number };
type Placed = SceneNode & Box;
type Port = { tip: Point; stub: Point };
const grid = 10;

/** Wrap long identifiers too; no label can silently overflow its reserved box. */
export function wrapDiagramText(value: string, limit: number): string[] {
  const words = value.trim().split(/\s+/).flatMap(word => {
    const chunks: string[] = [];
    for (let i = 0; i < word.length; i += limit) chunks.push(word.slice(i, i + limit));
    return chunks;
  });
  const lines: string[] = [];
  for (const word of words) {
    if (!lines.length || lines.at(-1)!.length + word.length + 1 > limit) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines;
}

/** Stable dependency order. A cycle keeps its real edges, including feedback. */
function orderedNodes(scene: Scene) {
  const remaining = [...scene.nodes], ordered: SceneNode[] = [];
  while (remaining.length) {
    let index = remaining.findIndex(n => !scene.edges.some(e => e.to === n.id && remaining.some(r => r.id === e.from)));
    if (index < 0) index = 0;
    ordered.push(remaining.splice(index, 1)[0]);
  }
  return ordered;
}

function ports(node: Placed, scene: Scene, edgeIndex: number): Port[] {
  const incident = scene.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === node.id || e.to === node.id);
  const fraction = (incident.findIndex(({ i }) => i === edgeIndex) + 1) / (incident.length + 1);
  const x = node.x + Math.round(node.w * fraction / grid) * grid;
  const y = node.y + Math.round(node.h * fraction / grid) * grid;
  return [
    { tip: { x, y: node.y }, stub: { x, y: node.y - 20 } },
    { tip: { x, y: node.y + node.h }, stub: { x, y: node.y + node.h + 20 } },
    { tip: { x: node.x, y }, stub: { x: node.x - 20, y } },
    { tip: { x: node.x + node.w, y }, stub: { x: node.x + node.w + 20, y } },
  ];
}

class MinHeap<T> {
  private items: { cost: number; value: T }[] = [];
  push(value: T, cost: number) {
    const item = { value, cost };
    let i = this.items.length;
    this.items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].cost <= cost) break;
      this.items[i] = this.items[parent]; i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    if (!this.items.length) return undefined;
    const first = this.items[0], last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].cost < this.items[child].cost) child++;
        if (this.items[child].cost >= last.cost) break;
        this.items[i] = this.items[child]; i = child;
      }
      this.items[i] = last;
    }
    return first.value;
  }
}
const pointKey = (p: Point) => `${p.x},${p.y}`;
const segmentKey = (a: Point, b: Point) => [pointKey(a), pointKey(b)].sort().join("|");

/** Orthogonal A*: expanded node bounds are obstacles; edges cannot share segments. */
function route(starts: Port[], ends: Port[], boxes: Box[], width: number, height: number, occupied: Set<string>): Point[] {
  const portFree = (port: Port) => {
    const middle = { x: (port.tip.x + port.stub.x) / 2, y: (port.tip.y + port.stub.y) / 2 };
    return !occupied.has(segmentKey(port.tip, middle)) && !occupied.has(segmentKey(middle, port.stub));
  };
  starts = starts.filter(portFree); ends = ends.filter(portFree);
  if (!starts.length || !ends.length) throw new Error("Diagram routing has no free connection ports.");
  type State = { point: Point; direction: number; cost: number; key: string };
  const queue = new MinHeap<State>(), best = new Map<string, number>();
  const parents = new Map<string, string>(), points = new Map<string, Point>();
  const roots = new Map<string, Port>();
  const blocked = (p: Point) => p.x < 20 || p.x > width - 20 || p.y < 80 || p.y > height - 20 ||
    boxes.some(b => p.x > b.x - 10 && p.x < b.x + b.w + 10 && p.y > b.y - 10 && p.y < b.y + b.h + 10);
  const heuristic = (p: Point) => Math.min(...ends.map(e => Math.abs(e.stub.x - p.x) + Math.abs(e.stub.y - p.y)));
  for (const start of starts) {
    const direction = start.stub.x === start.tip.x ? 1 : 0;
    const key = `${pointKey(start.stub)}:${direction}`;
    queue.push({ point: start.stub, direction, cost: 0, key }, heuristic(start.stub));
    best.set(key, 0); roots.set(key, start); points.set(key, start.stub);
  }
  let current: State | undefined;
  while ((current = queue.pop())) {
    if (current.cost !== best.get(current.key)) continue;
    const end = ends.find(e => e.stub.x === current!.point.x && e.stub.y === current!.point.y);
    if (end) {
      const path: Point[] = [end.tip];
      let key = current.key;
      while (parents.has(key)) { path.push(points.get(key)!); key = parents.get(key)!; }
      path.push(points.get(key)!, roots.get(key)!.tip);
      path.reverse();
      // Reserve every grid segment, including the short shape-to-stub sections.
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        for (let t = 0; t < length; t += grid) {
          const at = (offset: number) => ({ x: a.x + Math.sign(b.x - a.x) * offset, y: a.y + Math.sign(b.y - a.y) * offset });
          occupied.add(segmentKey(at(t), at(t + grid)));
        }
      }
      return path.filter((p, i) => !i || i === path.length - 1 ||
        !((path[i - 1].x === p.x && p.x === path[i + 1].x) || (path[i - 1].y === p.y && p.y === path[i + 1].y)));
    }
    for (const [dx, dy, direction] of [[grid, 0, 0], [-grid, 0, 0], [0, grid, 1], [0, -grid, 1]]) {
      const p = { x: current.point.x + dx, y: current.point.y + dy };
      if (blocked(p) || occupied.has(segmentKey(current.point, p))) continue;
      const key = `${pointKey(p)}:${direction}`, cost = current.cost + grid + (direction === current.direction ? 0 : 18);
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost); parents.set(key, current.key); points.set(key, p);
      queue.push({ point: p, direction, cost, key }, cost + heuristic(p));
    }
  }
  throw new Error("Diagram routing could not find a clear connection.");
}

export function layoutScene(scene: Scene, mobile: boolean) {
  const width = mobile ? 380 : 800, nodeWidth = mobile ? 240 : 260;
  const ordered = orderedNodes(scene);
  const nodes: Placed[] = ordered.map((n, i) => {
    const row = mobile ? i : Math.floor(i / 2);
    const column = mobile ? 0 : row % 2 ? 1 - i % 2 : i % 2;
    return { ...n, x: mobile ? 70 : 80 + column * 380, y: 110 + row * (mobile ? 210 : 190), w: nodeWidth, h: mobile || n.kind === "circle" || n.kind === "experts" ? 140 : 110 };
  });
  const height = Math.max(...nodes.map(n => n.y + n.h)) + 70;
  const occupied = new Set<string>();
  const edges = scene.edges.map((edge, i) => {
    const from = nodes.find(n => n.id === edge.from)!, to = nodes.find(n => n.id === edge.to)!;
    return { ...edge, points: route(ports(from, scene, i), ports(to, scene, i), nodes, width, height, occupied) };
  });
  return { width, height, nodes, edges };
}

/** Extend rectangle-boundary ports to the actual ellipse, without moving the exterior route. */
function shapeEndpoint(point: Point, node: Placed): Point {
  if (node.kind !== "circle") return point;
  const cx = node.x + node.w / 2, cy = node.y + node.h / 2;
  if (point.x === node.x || point.x === node.x + node.w) {
    const rx = node.w / 2 * Math.sqrt(Math.max(0, 1 - ((point.y - cy) / (node.h / 2)) ** 2));
    return { x: cx + (point.x < cx ? -rx : rx), y: point.y };
  }
  const ry = node.h / 2 * Math.sqrt(Math.max(0, 1 - ((point.x - cx) / (node.w / 2)) ** 2));
  return { x: point.x, y: cy + (point.y < cy ? -ry : ry) };
}

export function flowSceneSvg(scene: Scene, mobile: boolean, accent: string) {
  const layout = layoutScene(scene, mobile);
  const text = (x: number, y: number, value: string, size = 14, anchor = "middle", fill = "#34332f") =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono, monospace" font-size="${size}" fill="${fill}">${diagramText(value)}</text>`;
  const title = wrapDiagramText(scene.title, mobile ? 32 : 70).map((line, i) => text(layout.width / 2, 28 + i * 19, line)).join("");
  const nodes = layout.nodes.map(n => {
    const fill = n.emphasis ? accent + "18" : "#fafaf9", stroke = n.emphasis ? accent : "#d6d4da";
    // Keep labels and details inside the routing obstacle. Shape motifs carry no invented values.
    const shape = n.kind === "circle"
      ? `<ellipse cx="${n.x + n.w / 2}" cy="${n.y + n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" fill="${fill}" stroke="${stroke}"/>`
      : `${n.kind === "stack" ? `<path d="M${n.x + 6} ${n.y - 5} H${n.x + n.w + 5} V${n.y + n.h - 6}" fill="none" stroke="${stroke}"/>` : ""}<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.kind === "matrix" ? 0 : 8}" fill="${fill}" stroke="${stroke}"/>`;
    const labelLines = wrapDiagramText(n.label, n.kind === "circle" ? 20 : mobile ? 22 : 25);
    const detailLines = wrapDiagramText(n.detail, n.kind === "circle" ? 23 : mobile ? 25 : 29);
    const labelY = n.y + (n.kind === "circle" ? 44 : 32);
    return `<g data-concept="${n.id}" data-node-bounds="${n.x},${n.y},${n.w},${n.h}">${shape}${labelLines.map((l, i) => text(n.x + n.w / 2, labelY + i * 18, l, mobile ? 16 : 14)).join("")}${detailLines.map((l, i) => text(n.x + n.w / 2, labelY + labelLines.length * 18 + 12 + i * 16, l, mobile ? 14 : 12, "middle", "#62675f")).join("")}</g>`;
  }).join("");
  const marker = mobile ? "flow-arrow-mobile" : "flow-arrow-desktop";
  const edges = layout.edges.map(e => {
    const points = e.points.map((p, i) => i === 0 ? shapeEndpoint(p, layout.nodes.find(n => n.id === e.from)!)
      : i === e.points.length - 1 ? shapeEndpoint(p, layout.nodes.find(n => n.id === e.to)!) : p);
    const d = points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
    return `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="5"/><path data-connector="true" data-from="${escapeXml(e.from)}" data-to="${escapeXml(e.to)}" d="${d}" fill="none" stroke="${accent}" stroke-width="1.5" marker-end="url(#${marker})" ${e.dashed ? 'stroke-dasharray="5 5"' : ""}><title>${escapeXml(e.label || `${e.from} to ${e.to}`)}</title></path>`;
  }).join("");
  // Relationship captions retain every edge label, including feedback and skip edges.
  // Explicit endpoints avoid detached labels and preserve meaning on narrow screens.
  let y = layout.height + 4, captions = "";
  const captionSize = mobile ? 14 : 12, captionLine = mobile ? 20 : 17;
  for (const e of scene.edges.filter(e => e.label)) {
    const from = scene.nodes.find(n => n.id === e.from)!.label;
    const to = scene.nodes.find(n => n.id === e.to)!.label;
    const lines = wrapDiagramText(`${from} → ${to}: ${e.label}`, mobile ? 37 : 84);
    captions += lines.map((line, i) => text(24, y + i * captionLine, line, captionSize, "start", "#62675f")).join("");
    y += lines.length * captionLine + 14;
  }
  y += 12;
  const foot = wrapDiagramText(scene.footnote, mobile ? 37 : 84);
  captions += foot.map((line, i) => text(24, y + i * captionLine, line, captionSize, "start", "#62675f")).join("");
  const height = y + foot.length * captionLine + 15;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${height}" role="img" aria-label="${escapeXml(scene.description)}"><title>${escapeXml(scene.title)}</title><desc>${escapeXml(scene.description)}</desc><defs><marker id="${marker}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="${accent}"/></marker></defs>${title}${edges}${nodes}${captions}</svg>`;
}
