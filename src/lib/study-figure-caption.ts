import type { StudyFigure } from "./study";

/** Presentation only: retain the stored caption for source reviews and SVG exports. */
export function studyFigureCaption(figure: StudyFigure): string {
  // A symbolic grid contains treatments such as skip/mask/compute, not quantities.
  // Keep every measurement caveat on quantitative or mixed figures.
  const symbolicGrid = figure.kind === "illustration" && figure.illustration.panels.every(panel =>
    panel.kind === "matrix" && panel.values.flat().every(value =>
      value.trim().length > 0 && !/\d/u.test(value)),
  );
  if (figure.provenance !== "illustrative" || !symbolicGrid) return figure.caption;
  return figure.caption
    .replace(/^Invented (\d+\s*[×x]\s*\d+) teaching grid:/u, "Simplified $1 grid:")
    .replace(/\s*Values are not measurements\.\s*$/u, "");
}
