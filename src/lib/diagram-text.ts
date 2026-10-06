export const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
/** Native SVG scripts avoid missing Unicode subscript glyphs in UI fonts. */
export function diagramText(value: string) {
  const subs: Record<string, string> = {
    "₀": "0",
    "₁": "1",
    "₂": "2",
    "₃": "3",
    "₄": "4",
    "₅": "5",
    "₆": "6",
    "₇": "7",
    "₈": "8",
    "₉": "9",
    ₐ: "a",
    ₑ: "e",
    ₕ: "h",
    ᵢ: "i",
    ⱼ: "j",
    ₖ: "k",
    ₗ: "l",
    ₘ: "m",
    ₙ: "n",
    ₒ: "o",
    ₚ: "p",
    ᵣ: "r",
    ₛ: "s",
    ₜ: "t",
    ᵤ: "u",
    ᵥ: "v",
    ₓ: "x",
  };
  const supers: Record<string,string> = {"ᵀ":"T","⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁻":"−","⁺":"+"};
  return escapeXml(value)
    .replace(/[ᵀ⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, s => `<tspan baseline-shift="super" font-size="70%">${[...s].map(c=>supers[c]).join("")}</tspan>`)
    .replace(
      /[₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+/g,
      (s) =>
        `<tspan baseline-shift="sub" font-size="70%">${[...s].map((c) => subs[c]).join("")}</tspan>`,
    )
    .replace(
      /_([0-9a-z])\b/g,
      '<tspan baseline-shift="sub" font-size="70%">$1</tspan>',
    )
    .replace(
      /\^([T0-9])/g,
      '<tspan baseline-shift="super" font-size="70%">$1</tspan>',
    );
}
