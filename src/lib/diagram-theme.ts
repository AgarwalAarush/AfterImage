type Paint = "fill" | "stroke" | "stop-color";

/** Browser-only presentation adapter. The worker's reviewed SVG stays unchanged. */
export function diagramPaint(value: string, paint: Paint = "fill", text = false): string {
  const rgb = value.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (rgb) {
    // The study heat scale is [245,243,248] -> [119,96,170]. Keep its
    // ordering and contrast with the existing light/white value labels.
    const t = Math.max(0, Math.min(1, (245 - Number(rgb[1])) / 126));
    const low = [40, 34, 49], high = [105, 79, 145];
    const dark = `rgb(${low.map((v, i) => Math.round(v + (high[i] - v) * t)).join(",")})`;
    return `light-dark(${value}, ${dark})`;
  }
  let hex = value === "white" ? "ffffff" : value.replace(/^#/, "");
  if (/^[a-f\d]{3}$/i.test(hex)) hex = hex.split("").map(v => v + v).join("");
  if (!/^[a-f\d]{6}([a-f\d]{2})?$/i.test(hex)) return value;
  if (paint === "stop-color" && ["f5f3f8", "7760aa"].includes(hex)) {
    return `light-dark(${value}, ${hex === "f5f3f8" ? "#282231" : "#694f91"})`;
  }
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const min = Math.min(r, g, b), max = Math.max(r, g, b);
  const light = (min + max) / 510;
  let family = "";
  if (max - min >= 20 || (light > .85 && max - min >= 6)) {
    family = b > r && b > g ? (r > g ? "violet" : "blue") : g > r && g > b ? "green" : r > b && g > b && g > r * .7 ? "ochre" : "red";
  }
  let token: string;
  if (text) {
    if (light > .96) return value; // White labels on dark quantitative cells.
    token = family && light > .35 ? family : light < .3 ? "ink" : "muted";
  } else if (paint === "stroke") {
    if (light > .96) return value; // Contours must contrast with heat cells.
    token = family && light < .8 ? family : "line";
  } else {
    token = family ? (light > .8 || hex.length === 8 ? family + "-surface" : family) : "surface";
  }
  return `var(--diagram-${token}, ${value})`;
}

export function themedSvg(svg: string, labelsOnColor = false): string {
  return svg.replace(/<(?:[^>]+)>/g, tag => {
    const isText = /^<(?:text|tspan)\b/.test(tag);
    return tag.replace(/\b(fill|stroke|stop-color)="([^"]+)"/g, (_, paint: Paint, value: string) => {
      // flow-v2 uses a white five-pixel underlay to separate crossing arrows.
      const halo = paint === "stroke" && value === "#ffffff" && tag.includes('stroke-width="5"');
      let color = halo ? "var(--diagram-canvas, #ffffff)" : diagramPaint(value, paint, isText);
      if (isText && labelsOnColor) color = color.replace("--diagram-muted", "--diagram-ink");
      return `${paint}="${color}"`;
    });
  });
}
