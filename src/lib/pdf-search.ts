import type { PdfTextPage } from "./pdf-location";

export type PdfSearchOptions = { matchCase: boolean; wholeWords: boolean };
export type PdfSearchMatch = { page: number; start: number; end: number };

export function normalizePdfSearchText(text: string) {
  return text.normalize("NFKC").replace(/([\p{L}])-\s*\n\s*(?=[\p{L}])/gu, "$1").replace(/\s+/gu, " ").trim();
}

/** Keep occurrence offsets stable for text-layer highlighting, including case-insensitive Unicode. */
export function findPdfTextMatches(pages: PdfTextPage[], query: string, options: PdfSearchOptions): PdfSearchMatch[] {
  const needle = normalizePdfSearchText(query);
  if (!needle) return [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, options.matchCase ? "gu" : "giu");
  const word = /[\p{L}\p{N}_]/u;
  return pages.flatMap(({ page, text }) => {
    const normalized = normalizePdfSearchText(text);
    return [...normalized.matchAll(pattern)].flatMap(match => {
      const start = match.index, end = start + match[0].length;
      const before = [...normalized.slice(Math.max(0, start - 2), start)].at(-1) || "";
      const after = [...normalized.slice(end, end + 2)][0] || "";
      if (options.wholeWords && (word.test(before) || word.test(after))) return [];
      return [{ page, start, end }];
    });
  });
}

/** Translate normalized offsets back to a PDF text item's original Unicode bytes. */
export function pdfSearchOriginalRange(text: string, start: number, end: number): [number, number] {
  const offsets: { start: number; end: number; space: boolean }[] = [];
  let offset = 0;
  for (const character of text) {
    for (const normalized of character.normalize("NFKC")) {
      const space = /\s/u.test(normalized);
      if (space && (!offsets.length || offsets.at(-1)?.space)) continue;
      for (let unit = 0; unit < normalized.length; unit++) {
        offsets.push({ start: offset, end: offset + character.length, space });
      }
    }
    offset += character.length;
  }
  if (offsets.at(-1)?.space) offsets.pop();
  return [offsets[start]?.start ?? text.length, offsets[end - 1]?.end ?? text.length];
}
