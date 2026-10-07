import type { Scene } from "./types";
import type { IllustrationPanel } from "./scene-illustration";
import { diagramText, escapeXml } from "./scene";
import { wrapDiagramText } from "./scene-layout";
import { schematicSvg } from "./scene-schematic-svg";
import { bucketRoutingSvg } from "./scene-buckets-svg";
import { allocationSvg } from "./scene-allocation-svg";
import { stateTraceSvg } from "./scene-state-trace-svg";
import { tokenTreeSvg } from "./scene-tree-svg";
import { memorySvg } from "./scene-memory-svg";
import { readableMatrixSvg } from "./scene-matrix-svg";

const ink = "#34332f", muted = "#62675f";
const text = (x: number, y: number, value: string, size = 14, fill = ink, anchor = "start") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="IBM Plex Mono, monospace" font-size="${size}" fill="${fill}">${diagramText(value)}</text>`;
const lines = (x: number, y: number, value: string, limit: number, size = 14, fill = ink) => {
  const wrapped = wrapDiagramText(value, limit);
  return { svg: wrapped.map((line, i) => text(x, y + i * (size + 6), line, size, fill)).join(""), height: wrapped.length * (size + 6) };
};

function panelSvg(panel: IllustrationPanel, width: number, accent: string, marker: string, barMax: number, panelId: string, mobile: boolean) {
  const title = lines(0, 23, panel.title, Math.floor(width / 10), 16);
  let svg = title.svg;
  let y = title.height + 26;
  svg += text(0, y, panel.illustrative ? "ILLUSTRATIVE EXAMPLE" : "SOURCE EXAMPLE", 14, muted);
  y += 34;
  if (panel.kind === "state-trace") {
    const graphic = stateTraceSvg(panel, width, marker, panelId);
    svg += `<g transform="translate(0 ${y})">${graphic.svg}</g>`;
    y += graphic.height + 22;
  } else if (panel.kind === "tree") {
    const graphic = tokenTreeSvg(panel, width, panelId);
    svg += `<g transform="translate(0 ${y})">${graphic.svg}</g>`;
    y += graphic.height + 22;
  } else if (panel.kind === "memory") {
    const graphic = memorySvg(panel, width, marker, panelId);
    svg += `<g transform="translate(0 ${y})">${graphic.svg}</g>`;
    y += graphic.height + 22;
  } else if (panel.kind === "allocation") {
    const graphic = allocationSvg(panel, width);
    svg += `<g transform="translate(0 ${y})">${graphic.svg}</g>`;
    y += graphic.height + 22;
  } else if (panel.kind === "schematic") {
    const graphic = schematicSvg(panel, width, accent, marker, panelId);
    svg += `<g transform="translate(0 ${y})">${graphic.svg}</g>`;
    y += graphic.height + 22;
  } else if (panel.kind === "routing" && panel.presentation === "buckets") {
    const graphic = bucketRoutingSvg(panel, width, marker, panelId);
    svg += `<g transform="translate(0 ${y})">${graphic.svg}</g>`;
    y += graphic.height + 22;
  } else if (panel.kind === "matrix" && panel.layout === "readable-matrix-v1") {
    const graphic=readableMatrixSvg(panel,width,accent,mobile);
    svg+=`<g transform="translate(0 ${y})">${graphic.svg}</g>`;
    y+=graphic.height+22;
  } else if (panel.kind === "matrix") {
    if (panel.selectionRule) {
      svg += text(0, y, `Top-${panel.selectionRule.k} per ${panel.selectionRule.axis}`, 12, accent);
      y += 25;
    }
    const cellW = Math.floor((width - 86) / panel.columns.length);
    const valueLimit = Math.max(2, Math.floor((cellW - 8) / 7.2));
    const cellH = Math.max(42, 14 + 18 * Math.max(...panel.values.flat().map(value => wrapDiagramText(value, valueLimit).length), ...panel.rows.map(row => wrapDiagramText(row, 10).length)));
    const axis = lines(86, y, panel.columnLabel, Math.floor((width - 86) / 7.2), 12, muted);
    svg += axis.svg;
    y += axis.height + 7;
    panel.columns.forEach((column, i) => {
      const w = lines(86 + i * cellW + 4, y, column, Math.max(2, Math.floor((cellW - 8) / 7.2)), 12);
      svg += w.svg;
    });
    const headerLines = Math.max(...panel.columns.map(c => wrapDiagramText(c, Math.max(2, Math.floor((cellW - 8) / 7.2))).length));
    y += headerLines * 18 + 15;
    const rowAxis = lines(0, y, panel.rowLabel, 10, 12, muted);
    svg += rowAxis.svg;
    y += rowAxis.height + 8;
    const start = y;
    panel.rows.forEach((row, r) => {
      svg += lines(0, start + r * cellH + 23, row, 10, 12).svg;
      panel.columns.forEach((_, c) => {
        const chosen = panel.selected.some(cell => cell.row === r && cell.column === c);
        const x = 86 + c * cellW, cy = start + r * cellH;
        svg += `<rect data-cell="${r},${c}" data-selected="${chosen}" x="${x}" y="${cy}" width="${cellW - 3}" height="${cellH - 3}" rx="3" fill="${chosen ? accent + "20" : "#f7f7f5"}" stroke="${chosen ? accent : "#e0dfdb"}"/>`;
        svg += wrapDiagramText(panel.values[r][c], valueLimit).map((line, i) => text(x + (cellW - 3) / 2, cy + 23 + i * 18, line, 12, ink, "middle")).join("");
        if (chosen) svg += `<path d="M${x + 4} ${cy + 6}h6" stroke="${accent}" stroke-width="2"/>`;
      });
    });
    y = start + panel.rows.length * cellH + 23;
    if(panel.selected.length){
      svg += `<rect x="0" y="${y - 10}" width="10" height="10" rx="2" fill="${accent}20" stroke="${accent}"/>${text(18, y, "Selected cells", 12, muted)}`;
      y += 29;
    }
  } else if (panel.kind === "routing") {
    const boxW = Math.min(124, Math.floor(width * .32));
    const labelLimit = Math.floor((boxW - 12) / 7.2);
    const boxH = Math.max(44, 14 + 16 * Math.max(...[...panel.left, ...panel.right].map(label => wrapDiagramText(label, labelLimit).length)));
    const gap = boxH + 24;
    const rightX = width - boxW;
    const leftAxis = lines(0, y, panel.leftLabel, labelLimit, 12, muted), rightAxis = lines(rightX, y, panel.rightLabel, labelLimit, 12, muted);
    svg += leftAxis.svg + rightAxis.svg;
    y += Math.max(leftAxis.height, rightAxis.height) + 10;
    const leftY = panel.left.map((_, i) => y + i * gap);
    const rightY = panel.right.map((_, i) => y + i * gap);
    // Crossings receive a white halo; arrowheads land on the selected group's boundary.
    for (const link of panel.links) {
      const fromLeft = panel.direction === "left-to-right";
      const x1 = fromLeft ? boxW : rightX, x2 = fromLeft ? rightX : boxW;
      const y1 = (fromLeft ? leftY[link.left] : rightY[link.right]) + boxH / 2;
      const y2 = (fromLeft ? rightY[link.right] : leftY[link.left]) + boxH / 2;
      const d = `M${x1} ${y1} C${width / 2} ${y1},${width / 2} ${y2},${x2} ${y2}`;
      const leftId = `${panelId}-left-${link.left}`, rightId = `${panelId}-right-${link.right}`;
      svg += `<path d="${d}" fill="none" stroke="white" stroke-width="5"/><path data-assignment="${link.left},${link.right}" data-connector="true" data-from="${fromLeft ? leftId : rightId}" data-to="${fromLeft ? rightId : leftId}" d="${d}" fill="none" stroke="${accent}" stroke-opacity=".8" stroke-width="1.5" marker-end="url(#${marker})"/>`;
    }
    for (const side of ["left", "right"] as const) {
      panel[side].forEach((label, i) => {
        const bx = side === "left" ? 0 : rightX, by = side === "left" ? leftY[i] : rightY[i];
        const labelLines = wrapDiagramText(label, labelLimit), count = panel.links.filter(link => link[side] === i).length;
        svg += `<rect data-concept="${panelId}-${side}-${i}" data-node-bounds="${bx},${by},${boxW},${boxH}" x="${bx}" y="${by}" width="${boxW}" height="${boxH}" rx="5" fill="${count > 1 ? accent + "15" : "#fafaf9"}" stroke="${count > 1 ? accent : "#d6d4da"}" ${!count ? 'stroke-dasharray="3 3"' : ""}/>`;
        svg += labelLines.map((line, lineIndex) => text(bx + boxW / 2, by + boxH / 2 + 4 + (lineIndex - (labelLines.length - 1) / 2) * 16, line, 12, ink, "middle")).join("");
        if (panel.counts === side || panel.counts === "both") {
          const unit = side === "left" ? panel.leftCountUnit : panel.rightCountUnit;
          svg += text(bx + boxW / 2, by + boxH + 15, `${count} ${unit ? count === 1 ? unit.singular : unit.plural : count === 1 ? "link" : "links"}`, 11, muted, "middle");
        }
      });
    }
    y += Math.max(panel.left.length, panel.right.length) * gap + 6;
  } else {
    svg += text(0, y, panel.unit, 12, muted);
    y += 26;
    const max = barMax, barW = width - 92;
    panel.items.forEach(item => {
      svg += text(0, y, item.label, 12);
      y += 13;
      const valueWidth = item.value / max * barW;
      svg += `<path d="M0 ${y - 3}v24" stroke="#aaa9a3"/><rect x="1" y="${y}" width="${barW}" height="17" fill="#f1f0ed"/><rect x="1" y="${y}" width="${valueWidth}" height="17" fill="${accent}60"/>`;
      svg += text(barW + 10, y + 13, Number(item.value.toPrecision(4)).toString(), 12);
      y += 45;
    });
    svg += text(0, y, `0 baseline · max ${Number(max.toPrecision(4))}`, 11, muted);
    y += 28;
  }
  const caption = lines(0, y, panel.caption, Math.floor(width / 8.4), 14, muted);
  return { svg: svg + caption.svg, height: y + caption.height + 16 };
}

/** Publication-size panels recompose for mobile rather than shrinking desktop text. */
export function illustrationSvg(scene: Scene, mobile: boolean, accent: string) {
  const illustration = scene.illustration!;
  const width = mobile ? 380 : 1000, padding = mobile ? 24 : 32, gap = 32;
  const count = illustration.panels.length;
  // At most two columns: six-column matrices must remain legible at 880px publication width.
  const columns = mobile || count === 1 ? 1 : 2;
  const panelW = (width - padding * 2 - gap * (columns - 1)) / columns;
  const marker = `illustration-arrow-${mobile ? "mobile" : "desktop"}`;
  const heading = lines(padding, 30, scene.title, Math.floor((width - padding * 2) / 12), 20);
  const takeaway = lines(padding, 30 + heading.height + 6, illustration.takeaway, Math.floor((width - padding * 2) / 9.6), 16, muted);
  let y = 30 + heading.height + takeaway.height + 44, svg = heading.svg + takeaway.svg;
  for (let index = 0; index < count;) {
    const fullWidth=(panel:IllustrationPanel|undefined)=>!!panel&&(["schematic", "state-trace"].includes(panel.kind)||(panel.kind==="matrix"&&panel.layout==="readable-matrix-v1"));
    const full = fullWidth(illustration.panels[index]);
    const rowCount = full ? 1 : columns === 2 && !fullWidth(illustration.panels[index + 1]) && index + 1 < count ? 2 : 1;
    const rowW = full ? width - padding * 2 : panelW;
    const panels = illustration.panels.slice(index, index + rowCount).map((panel, col) => {
      const max = panel.kind === "bars" ? /%|percent/i.test(panel.unit) ? 100 : (Math.max(...illustration.panels.flatMap(other => other.kind === "bars" && other.unit === panel.unit ? other.items.map(item => item.value) : [])) || 1) : 1;
      return panelSvg(panel, rowW, accent, marker, max, `panel-${index + col}`,mobile);
    });
    const height = Math.max(...panels.map(panel => panel.height));
    panels.forEach((panel, col) => {
      svg += `<g data-panel="${index + col}" transform="translate(${padding + col * (rowW + gap)} ${y})">${panel.svg}</g>`;
    });
    y += height + 28;
    index += rowCount;
  }
  svg += `<path d="M${padding} ${y}H${width - padding}" stroke="#e5e3df"/>`;
  y += 27;
  const foot = lines(padding, y, scene.footnote, Math.floor((width - padding * 2) / 8.4), 14, muted);
  svg += foot.svg;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${y + foot.height + 12}" role="img" aria-label="${escapeXml(scene.description)}"><title>${escapeXml(scene.title)}</title><desc>${escapeXml(scene.description)}</desc><defs><marker id="${marker}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="${accent}"/></marker></defs>${svg}</svg>`;
}
