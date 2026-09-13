import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { extractSources } from "../src/lib/papers";
import type { Paper, Source } from "../src/lib/types";
const exec = promisify(execFile);
export async function researchSources(paper: Paper) {
  const html = await extractSources(paper);
  if (html.scope === "full-text") return html;
  try {
    const { stdout } = await exec(
      process.env.AFTERIMAGE_PYTHON || path.resolve(".venv/bin/python"),
      [path.resolve("worker/pdf_text.py"), paper.arxivId],
      { timeout: 60000, maxBuffer: 500000 },
    );
    const pages: Source[] = JSON.parse(stdout);
    if (pages.length >= 2)
      return {
        scope: "full-text" as const,
        sources: [html.sources[0], ...pages],
      };
  } catch {
    console.log(
      "PDF extraction unavailable; retaining abstract-only evidence.",
    );
  }
  return html;
}
