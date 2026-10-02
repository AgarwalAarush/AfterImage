import * as cheerio from "cheerio";
import type { Paper, Source } from "./types";
export const SOURCE_EXTRACTION_VERSION="arxiv-html-scientific-body-v5";

/** A LaTeXML PDF inclusion stub is metadata, never scientific body evidence. */
export function isSourcePlaceholder(text:string){
  return /^See pages?\s+\S+[-–]\S+\s+of\s+\S+\.pdf\.?$/i.test(text.replace(/\s+/g," ").trim());
}
/** Full-text scope needs substantive body excerpts; abstracts and PDF pointers do not count. */
export function hasSubstantiveSourceBody(sources:Source[]){
  return sources.filter(source=>source.id!=="abstract"&&!isSourcePlaceholder(source.excerpt))
    .reduce((sum,source)=>sum+source.excerpt.replace(/\[(?:EXTRACTION TRUNCATED|SOURCE BUDGET REACHED)[^\]]*\]/g,"").trim().length,0)>=400;
}

/** Retain scientific structure before making bounded source excerpts. Never execute HTML. */
export function sourcesFromHtml(paper: Paper, html: string): Source[] {
  const $ = cheerio.load(html);
  $("script,style,nav,footer,.ltx_bibliography,.ltx_acknowledgements,.ltx_acknowledgments").remove();
  $("math").each((_, el) => {
    const tex = $(el).attr("alttext") || $(el).find('annotation[encoding="application/x-tex"]').text();
    if (tex) $(el).replaceWith($("<span>").text(` LATEX: ${tex} `));
  });
  const sources = paper.sources.slice(0, 1);
  const selector = "p.ltx_p,.ltx_equation,.ltx_equationgroup,table.ltx_tabular,figcaption,.ltx_caption";
  function collectBlocks(elements:ReturnType<typeof $>){
    const blocks: string[] = [];
    elements.each((_, element) => {
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
        if (value&&!isSourcePlaceholder(value)) blocks.push(($(element).is("figcaption,.ltx_caption") ? "CAPTION (figure pixels not extracted): " : "") + value);
      }
    });
    return blocks;
  }
  function appendBlocks(blocks:string[],identity:string,label:string,url:string){
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
        return;
      }
      if (excerpt.trim()) sources.push({
        id: identity + (part ? `-part-${part + 1}` : ""),
        label: label + (part ? ` · part ${part + 1}` : ""),
        url,
        excerpt,
      });
    }
  }
  // Some papers place their complete main argument directly in ltx_document,
  // while only supplementary methods have section wrappers (e.g. AlphaZero).
  const article=$("article.ltx_document,.ltx_document").first();
  const scientificRoot=article.length?article:$("body");
  const unsectioned=scientificRoot.find(selector).filter((_,element)=>
    !$(element).parents("section.ltx_section,.ltx_appendix,.ltx_abstract,.ltx_title,.ltx_authors,.ltx_date").length);
  const articleAnchor=article.attr("id");
  appendBlocks(collectBlocks(unsectioned),"main-text","Original paper · unsectioned main text",
    `https://arxiv.org/html/${paper.arxivId}${articleAnchor?"#"+articleAnchor:""}`);
  $("section.ltx_section").filter((_,section)=>!$(section).parents(".ltx_appendix").length).each((i, section) => {
    const heading=$(section).find("h2,h3").first().text().trim();
    if(/^(?:(?:[0-9]+\.?|[ivx]+\.?)\s+)?(?:references|bibliography|acknowledg(?:e)?ments)(?:\s|$)/i.test(heading))return;
    const blocks=$(section).find(selector).filter((_,element)=>$(element).closest("section.ltx_section")[0]===section);
    appendBlocks(collectBlocks(blocks),`section-${i+1}`,heading||`Section ${i+1}`,
      `https://arxiv.org/html/${paper.arxivId}${$(section).attr("id")?"#"+$(section).attr("id"):""}`);
  });
  // Appendices carry algorithm details (e.g. TRPO's backtracking acceptance).
  // Append them after main evidence, keeping existing main-section identities.
  $("section.ltx_appendix").each((i,section)=>{
    const heading=$(section).find("h2,h3").first().text().trim();
    const blocks=$(section).find(selector).filter((_,element)=>$(element).closest("section.ltx_appendix")[0]===section);
    appendBlocks(collectBlocks(blocks),`appendix-${i+1}`,heading||`Appendix ${i+1}`,
      `https://arxiv.org/html/${paper.arxivId}${$(section).attr("id")?"#"+$(section).attr("id"):""}`);
  });
  return sources;
}
