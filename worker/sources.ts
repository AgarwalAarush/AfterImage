import { hasSubstantiveSourceBody } from "../src/lib/source-extraction";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { extractResearch } from "../src/lib/papers";
import { activateResearch, sourceLimits, researchPaperId, type ResearchBundle } from "../src/lib/research-bundle";
import type { Paper, Source } from "../src/lib/types";
const exec = promisify(execFile);
export async function researchSources(paper: Paper) {
  const html = await extractResearch(paper);
  if (html.scope === "full-text" && !html.coverage.unavailable.length && !html.coverage.omittedChunks && !html.coverage.sections.some(s => s.truncatedBlocks || s.omittedBlocks)) return html;
  return supplementPdf(paper, html);
}
export async function supplementPdf(paper: Paper, html: ResearchBundle): Promise<ResearchBundle> {
  try {
    const { stdout } = await exec(
      process.env.AFTERIMAGE_PYTHON || path.resolve(".venv/bin/python"),
      [path.resolve("worker/pdf_text.py"), researchPaperId(html.paperVersion || paper.arxivId)],
      { timeout: 60000, maxBuffer: 500000 },
    );
    const extracted: { pages: Source[]; totalPages: number; truncatedPages: number[] } = JSON.parse(stdout);
    const pages = extracted.pages;
    if (!Array.isArray(pages) || pages.some(s => !/^page-\d+$/.test(s.id) || s.excerpt.length > sourceLimits.chunk || !s.url.startsWith(`https://arxiv.org/pdf/${researchPaperId(html.paperVersion || paper.arxivId)}#page=`))) throw new Error("Invalid PDF extraction");
    if (pages.length) {
      const catalogue = [...html.catalogue, ...pages.filter(p => !html.catalogue.some(s => s.id === p.id))].slice(0, sourceLimits.catalogue);
      return activateResearch({ ...html, scope: hasSubstantiveSourceBody(catalogue) ? "full-text" : "abstract", catalogue,
        coverage: { ...html.coverage, method: html.scope === "full-text" ? "hybrid" : "pdf",
          unavailable: html.coverage.unavailable,
          omittedChunks: html.coverage.omittedChunks + Math.max(0, extracted.totalPages - 12) + Math.max(0, html.catalogue.length + pages.length - sourceLimits.catalogue),
          sections: [...html.coverage.sections, ...pages.map(p => ({ id: p.id, label: p.label, kind: "page" as const, blocks: 1, extractedBlocks: 1, omittedBlocks: 0, truncatedBlocks: extracted.truncatedPages.includes(Number(p.id.slice(5))) ? 1 : 0, sourceIds: [p.id] }))] } });
    }
  } catch {
    console.log(
      "PDF extraction unavailable; retaining bounded HTML evidence and coverage diagnostics.",
    );
  }
  return html;
}
