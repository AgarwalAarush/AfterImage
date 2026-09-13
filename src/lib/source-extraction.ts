import * as cheerio from "cheerio";
import type { Paper, Source } from "./types";

/** Retain scientific structure before making bounded source excerpts. Never execute HTML. */
export function sourcesFromHtml(paper: Paper, html: string): Source[] {
  const $ = cheerio.load(html);
  $("script,style,nav,footer,.ltx_bibliography").remove();
  $("math").each((_, el) => {
    const tex = $(el).attr("alttext") || $(el).find('annotation[encoding="application/x-tex"]').text();
    if (tex) $(el).replaceWith($("<span>").text(` LATEX: ${tex} `));
  });
  const sources = paper.sources.slice(0, 1);
  const selector = "p.ltx_p,.ltx_equation,.ltx_equationgroup,table.ltx_tabular,figcaption,.ltx_caption";
  $("section.ltx_section").each((i, section) => {
    const blocks: string[] = [];
    $(section).find(selector).each((_, element) => {
      if ($(element).parents(selector).length) return; // No duplicate caption/equation children.
      if ($(element).is("table.ltx_tabular")) {
        const grid: string[][] = [];
        $(element).find("tr").each((r, row) => {
          grid[r] ||= [];
          let col = 0;
          $(row).children("th,td").each((_, cell) => {
            while (grid[r][col] !== undefined) col++;
            const value = $(cell).text().replace(/\s+/g, " ").trim();
            const rows = Math.min(50, Math.max(1, Number($(cell).attr("rowspan")) || 1));
            const cols = Math.min(50, Math.max(1, Number($(cell).attr("colspan")) || 1));
            for (let dr = 0; dr < rows; dr++) {
              grid[r + dr] ||= [];
              for (let dc = 0; dc < cols; dc++) grid[r + dr][col + dc] = value;
            }
            col += cols;
          });
        });
        blocks.push("TABLE (spanning labels repeated to retain row/column context):\n" + grid.map(row => row.map(cell => cell || "—").join(" | ")).join("\n"));
      } else {
        const value = $(element).text().replace(/\s+/g, " ").trim();
        if (value) blocks.push(($(element).is("figcaption,.ltx_caption") ? "CAPTION (figure pixels not extracted): " : "") + value);
      }
    });
    const limit = 9500;
    const chunks: string[] = [];
    let chunk = "";
    for (const raw of blocks) {
      const block = raw.length > limit ? raw.slice(0, limit) + "\n[EXTRACTION TRUNCATED: this block exceeded the limit. Do not infer missing text or table values.]" : raw;
      if (chunk && chunk.length + block.length + 2 > limit) { chunks.push(chunk); chunk = ""; }
      chunk += (chunk ? "\n\n" : "") + block;
    }
    if (chunk) chunks.push(chunk);
    for (const [part, excerpt] of chunks.entries()) {
      if (sources.length >= 14) {
        const last = sources.at(-1)!;
        if (!last.excerpt.includes("SOURCE BUDGET REACHED")) last.excerpt += "\n[SOURCE BUDGET REACHED: additional source blocks are omitted. Consult the original paper for complete coverage.]";
        return false;
      }
      if (excerpt.trim()) sources.push({
        id: `section-${i + 1}${part ? `-part-${part + 1}` : ""}`,
        label: ($(section).find("h2,h3").first().text().trim() || `Section ${i + 1}`) + (part ? ` · part ${part + 1}` : ""),
        url: `https://arxiv.org/html/${paper.arxivId}${$(section).attr("id") ? "#" + $(section).attr("id") : ""}`,
        excerpt,
      });
    }
  });
  return sources;
}
