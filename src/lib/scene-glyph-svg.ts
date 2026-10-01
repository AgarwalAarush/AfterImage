import type { Glyph } from "./scene-glyphs";
import { diagramText } from "./scene";
import { wrapDiagramText } from "./scene-layout";

const fmt = (value: number) => Number(value.toPrecision(4)).toString();
const text = (x: number, y: number, value: string, size = 14, fill = "#34332f", anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono, monospace" font-size="${size}" fill="${fill}">${diagramText(value)}</text>`;

/** Shapes carry data: angle, occupancy, repeated identity, or distribution parameters. */
export function glyphSvg(glyph: Glyph, x: number, y: number, width: number, accent: string) {
  const cx = x + width / 2, cy = y + 74, inner = width - 24;
  let svg = "";
  if (glyph.glyph === "gauge") {
    const radius = Math.min(65, width / 2 - 16), polar = (angle: number) => ({ x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) });
    const a = polar(Math.PI), b = polar(0), needle = polar(Math.PI * (1 - glyph.value));
    svg += `<path d="M${a.x} ${a.y} A${radius} ${radius} 0 0 1 ${b.x} ${b.y}" fill="none" stroke="${accent}45" stroke-width="12" stroke-linecap="round"/><path data-gauge-value="${glyph.value}" d="M${cx} ${cy} L${needle.x} ${needle.y}" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="${accent}"/>`;
    svg += text(a.x, cy + 22, "0", 14, "#62675f") + text(b.x, cy + 22, "1", 14, "#62675f") + text(cx, cy + 22, fmt(glyph.value), 14);
    if (glyph.inverse) svg += wrapDiagramText(`1/value = ${fmt(1 / glyph.value)}×`, Math.floor(width / 8.4)).map((line, i) => text(cx, cy + 44 + i * 18, line, 14, accent)).join("");
  } else if (glyph.glyph === "gaussian") {
    const left = x + 12, bottom = cy + 30, plotW = inner;
    const points = Array.from({ length: 49 }, (_, i) => { const z = -3 + i / 8; return [left + plotW * i / 48, bottom - 70 * Math.exp(-z * z / 2)]; });
    const curve = points.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join(" ");
    svg += `<path d="${curve} L${left + plotW} ${bottom} H${left}Z" fill="${accent}18"/><path d="${curve}" fill="none" stroke="${accent}" stroke-width="2"/><path d="M${left} ${bottom}H${left + plotW}" stroke="#aaa8a4"/>`;
    svg += wrapDiagramText(`μ=${fmt(glyph.mean)}, σ=${fmt(glyph.deviation)}`, Math.floor(width / 8.4)).map((line, i) => text(cx, bottom + 18 + i * 18, line, 14)).join("");
    if (glyph.sample !== null) {
      const sx = left + plotW * ((glyph.sample - glyph.mean) / glyph.deviation + 3) / 6;
      svg += `<path d="M${sx} ${bottom - 80}V${bottom}" stroke="#638eae" stroke-dasharray="4 4"/><circle data-sample="${glyph.sample}" cx="${sx}" cy="${bottom}" r="5" fill="#638eae"/>`;
      svg += text(cx, bottom + 47, `sample = ${fmt(glyph.sample)}`, 14, "#638eae");
    }
  } else if (glyph.glyph === "bank") {
    const cols = Math.min(width<160?2:3, glyph.capacity), rows=Math.ceil(glyph.capacity/cols), cellW=Math.min(48,inner/cols), start=cx-cellW*cols/2,top=cy-36;
    svg += `<path d="M${x+8} ${top-4}V${top+rows*26+8}H${x+width-8}V${top-4}" fill="${accent}08" stroke="${accent}" stroke-width="2"/>`;
    for(let i=0;i<glyph.capacity;i++){
      svg += `<rect data-slot="${i}" data-occupied="${i<glyph.items.length}" x="${start+(i%cols)*cellW+3}" y="${top+Math.floor(i/cols)*26}" width="${cellW-6}" height="23" rx="3" fill="${i<glyph.items.length?accent+"28":"#f7f7f5"}" stroke="${i<glyph.items.length?accent:"#d6d4da"}"/>`;
      if(glyph.items[i])svg+=text(start+(i%cols+.5)*cellW,top+16+Math.floor(i/cols)*26,glyph.items[i],14);
    }
    svg+=text(cx,top+rows*26+25,`${glyph.items.length}/${glyph.capacity} slots`,14,accent);
  } else if (glyph.glyph === "vector") {
    const total = glyph.values.length * 27, top = cy - total / 2;
    svg += `<path d="M${cx - 42} ${top}h-8v${total}h8 M${cx + 42} ${top}h8v${total}h-8" stroke="${accent}" stroke-width="2" fill="none"/>`;
    glyph.values.forEach((value, i) => { svg += text(cx, top + 19 + i * 27, value, 15); });
  } else if (glyph.glyph === "tokens") {
    glyph.items.forEach((value, i) => {
      const col = i % 3, row = Math.floor(i / 3), cell = inner / 3, px = x + 12 + (col + .5) * cell, py = cy - 16 + row * 40;
      svg += `<circle cx="${px}" cy="${py}" r="16" fill="${accent}15" stroke="${accent}"/>${text(px, py + 4, value, 13)}`;
    });
  } else {
    svg += `<path d="M${x + 12} ${cy - 32}l10 -8h${inner - 10}v64l-10 8 M${x + width - 12} ${cy - 32}l10 -8" fill="${accent}10" stroke="${accent}80"/><rect x="${x + 12}" y="${cy - 32}" width="${inner}" height="64" rx="4" fill="${accent}15" stroke="${accent}"/>`;
  }
  const labels = wrapDiagramText(glyph.label, Math.floor((glyph.glyph==="module"?inner:width) / 8.4));
  svg += labels.map((line, i) => text(cx, glyph.glyph === "module" ? cy + 5 + (i - (labels.length - 1) / 2) * 18 : y + 170 + i * 18, line, 14)).join("");
  const details = wrapDiagramText(glyph.detail, Math.floor(width / 8.4));
  svg += details.map((line, i) => text(cx, y + (glyph.glyph === "module" ? 154 : 170 + labels.length * 18 + 7) + i * 18, line, 14, "#62675f")).join("");
  return svg;
}
