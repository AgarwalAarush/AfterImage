"use client";
import Link from "next/link";
import { PaperAssistant } from "./paper-assistant";
import { PaperPreparation } from "./paper-preparation";
import { StudyFigures, PaperQuiz } from "./paper-study";
import { Download, ArrowUpRight, Bookmark, RefreshCw } from "lucide-react";
import type { Paper } from "@/lib/types";
import { useApp } from "./app";
import { Diagram } from "./diagram";
import { eagleCaption } from "./eagle-diagram";
import { MathText, RecallText, InlineText } from "./math";
import { paperPreparationModel, withPreparationRequest } from "@/lib/generation-progress";
import { readerUrl } from "@/lib/identity";
import { download } from "@/lib/download";
import { workedExampleForEquation } from "@/lib/worked-examples";
import { WorkedExampleAnimation } from "./worked-example";
import "katex/dist/katex.min.css";

export function PaperView({ id }: { id: string }) {
  const { state, act, busy, toast, preparations } = useApp();
  if (!state) return null;
  const p = state.papers.find((p) => p.id === id);
  if (!p)
    return (
      <div className="empty">
        <h1>Paper not found.</h1>
        <Link href="/library">Return to your library</Link>
      </div>
    );
  const e = state.entries[id];
  const r = p.recall;
  const preparation = withPreparationRequest(paperPreparationModel(p, state.jobs, state.workerSeenAt), preparations[id]);
  const ready = Boolean(preparation.readable);
  const publishedScene = Boolean(p.scene && p.kit?.components.some(c => c.id === "diagram" && c.revision && c.revision !== "legacy"));
  const workedEquationIndex = r?.equations?.findIndex(eq => workedExampleForEquation(p, eq)) ?? -1;
  const related = state.papers
    .filter((x) => x.id !== id && x.topics.some((t) => p.topics.includes(t)))
    .slice(0, 2);
  return (
    <PaperAssistant key={p.id} paper={p} available={ready}><div className={`page paper-page ${p.accent}`}>
      <div className="paper-breadcrumb">
        <Link href="/library">Library</Link>
        <span>/</span>
        <span>{ready ? "Notecard" : ["submitting", "queued", "running"].includes(preparation.status) ? "Preparing" : "Paper"}</span>
        {ready && (
          <button
            className="text-button"
            onClick={() => download(`${id}.md`, paperMarkdown(p))}
          >
            <Download size={14} />
            Export
          </button>
        )}
      </div>
      <header className={`paper-header ${ready ? "" : "preparing"}`}>
        <div className="eyebrow">
          {p.authors} · {p.year}
        </div>
        <h1>{p.title}</h1>
        <p><InlineText text={ready ? r?.idea || p.abstract : p.abstract} /></p>
        <div className="paper-header-actions">
          <a
            className="button primary"
            href={readerUrl(p)}
            target="_blank"
            rel="noreferrer"
          >
            Read in alphaXiv
            <ArrowUpRight size={16} />
          </a>
          <a
            className="text-button"
            href={`https://arxiv.org/abs/${id}`}
            target="_blank"
            rel="noreferrer"
          >
            Original paper
            <ArrowUpRight size={14} />
          </a>
          {e && (
            <select
              className="paper-status"
              disabled={busy}
              aria-label="Reading status"
              value={e.status}
              onChange={(ev) =>
                act({
                  action: "status",
                  paperId: id,
                  status: ev.target.value,
                }).catch(() => {})
              }
            >
              <option value="saved">To read</option>
              <option value="reading">Reading</option>
              <option value="read">Read</option>
              <option value="archived">Archived</option>
            </select>
          )}
          {!e && (
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                act({ action: "save", paperId: id }).catch(() => {})
              }
            >
              <Bookmark size={15} />
              Save paper
            </button>
          )}
        </div>
      </header>
      {preparation.status !== "ready" && <PaperPreparation paperId={id} model={preparation} />}
      {ready && <>
      {(p.scene || p.visual) && <section className="mechanism-panel panel">
        <div className="section-heading">
          <span className="eyebrow">THE IDEA, AT A GLANCE</span>
          <span className="eyebrow diagram-caption">
            {!publishedScene && p.id === "2503.01840" ? "EDITORIAL DIAGRAM" : p.scene && (publishedScene || p.visual !== "lora")
              ? "GENERATED FROM THE PAPER"
              : p.visual
                ? "EDITORIAL DIAGRAM"
                : "YOUR NEXT NOTECARD"}
          </span>
        </div>
        {p.scene || p.visual ? (
          <Diagram paper={p} />
        ) : (
          <div className="diagram-empty">
            <div className="ghost-cards">
              <span />
              <span />
              <span>∴</span>
            </div>
            <h3>Give this idea a shape.</h3>
            <p>Create a concise recap and a source-grounded diagram.</p>
          </div>
        )}
        <div className="mechanism-foot">
          <span>
            {(!publishedScene && p.id === "2503.01840" ? eagleCaption : !publishedScene && p.visual === "lora"
              ? "The input passes through A, then B. Their low-rank update is added to the frozen base output; the diagram omits the scaling factor."
              : p.scene?.description) ||
              r?.idea ||
              "Your notecard will stay with the paper."}
          </span>
          {(p.scene || p.visual) && (
            <button
              className="text-button"
              onClick={() =>
                import("@/lib/export-diagram").then(m => m.exportDiagram(id)).catch(() =>
                  toast("Could not export the diagram. Please try again."),
                )
              }
            >
              Save SVG
              <Download size={14} />
            </button>
          )}
        </div>
      </section>}
      <div className="paper-body-grid">
        <section className="recap-panel panel">
          <div className="section-heading">
            <span className="eyebrow">THE RECALL</span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                act({ action: "generate", paperId: id })
                  .then(() => toast("A fresh reading kit is queued."))
                  .catch(() => {})
              }
            >
              <RefreshCw size={13} />
              Regenerate package
            </button>
          </div>
          {r ? (
            <>
              <h2>
                <InlineText text={r.idea} />
              </h2>
              {[
                ["THE PROBLEM", r.problem],
                ["HOW IT WORKS", r.mechanism],
                ["WHAT THEY FOUND", r.evidence],
                ["KEEP IN MIND", r.limitation],
                ...(r.significance ? [["WHY IT MATTERS", r.significance]] : []),
              ].map(([label, text]) => (
                <div className="recap-section" key={label}>
                  <span className="eyebrow">{label}</span>
                  <RecallText text={text} />
                  {label === "HOW IT WORKS" && <StudyFigures paper={p} placement="mechanism"/>}
                  {label === "WHAT THEY FOUND" && <StudyFigures paper={p} placement="evidence"/>}
                </div>
              ))}
              {!!r.equations?.length && (
                <section className="recall-equations">
                  <span className="eyebrow">THE MECHANISM IN MATH</span>
                  {r.equations.map((eq, i) => {
                    const animation = i === workedEquationIndex ? workedExampleForEquation(p, eq) : null;
                    return (
                    <figure key={i}>
                      <h3><span className="math-step-number">{String(i + 1).padStart(2, "0")}</span>{eq.title || `Equation ${i + 1}`}</h3>
                      <MathText latex={eq.latex} display />
                      <figcaption>
                        <RecallText text={eq.explanation} />
                        {(eq.example || animation) && <div className="math-example"><span className="eyebrow">WORK IT THROUGH</span>{animation ? <WorkedExampleAnimation example={animation} fallback={<RecallText text={eq.example || animation.intro} />} /> : <RecallText text={eq.example!} />}</div>}
                        {p.sources.find((src) => src.id === eq.sourceId) && (
                          <a
                            href={
                              p.sources.find((src) => src.id === eq.sourceId)!
                                .url
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source ↗
                          </a>
                        )}
                      </figcaption>
                    </figure>
                  );})}
                </section>
              )}
              {r.walkthrough && <section className="recall-walkthrough">
                <h3>{r.walkthrough.title}</h3>
                <RecallText text={r.walkthrough.introduction} />
                <div className="walkthrough-table" role="region" aria-label={r.walkthrough.title} tabIndex={0}>
                  <table>
                    <thead><tr><th scope="col">Step</th><th scope="col">What goes in</th><th scope="col">What happens</th><th scope="col">What comes out</th></tr></thead>
                    <tbody>{r.walkthrough.steps.map((step, i) => <tr key={i}>
                      <th scope="row"><InlineText text={step.label} /></th>
                      <td data-label="What goes in"><InlineText text={step.input} /></td><td data-label="What happens"><InlineText text={step.operation} /></td><td data-label="What comes out"><InlineText text={step.output} /></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <a className="walkthrough-source" href={p.sources.find(s => s.id === r.walkthrough!.sourceId)?.url} target="_blank" rel="noreferrer">Walkthrough source ↗</a>
              </section>}
            </>
          ) : (
            <p className="muted">
              Create a notecard to pull out the problem, the mechanism, the
              evidence, and what to keep in mind.
            </p>
          )}
        </section>
      </div>
      {Boolean(p.study?.quiz.length) && <PaperQuiz paper={p}/>}
      {related.length > 0 && (
        <section className="related">
          <span className="eyebrow">PULL ON A RELATED THREAD</span>
          <div>
            {related.map((p) => (
              <Link href={`/papers/${encodeURIComponent(p.id)}`} key={p.id}>
                <h3>{p.title}</h3>
                <span>{p.topics.join(" · ")}</span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}
      </>}
    </div></PaperAssistant>
  );
}
function paperMarkdown(p: Paper) {
  const r = p.recall;
  const sections = r
    ? [
        ["The idea", r.idea],
        ["The problem", r.problem],
        ["How it works", r.mechanism],
        ["Evidence", r.evidence],
        ["Limitations", r.limitation],
        ["Why it matters", r.significance],
      ]
        .filter(([, text]) => text)
        .map(([title, text]) => `## ${title}\n${text}`)
        .join("\n\n")
    : "";
  const equations =
    r?.equations
      ?.map(
        (eq) =>
          `${eq.title ? `### ${eq.title}\n\n` : ""}$$\n${eq.latex}\n$$\n\n${eq.explanation}${eq.example ? `\n\nWorked example: ${eq.example}` : ""}\n\nSource: ${p.sources.find((s) => s.id === eq.sourceId)?.url || eq.sourceId}`,
      )
      .join("\n\n") || "";
  const walkthrough = r?.walkthrough ? `\n\n## ${r.walkthrough.title}\n\n${r.walkthrough.introduction}\n\n${r.walkthrough.steps.map(s => `### ${s.label}\nInput: ${s.input}\n\nOperation: ${s.operation}\n\nOutput: ${s.output}`).join("\n\n")}\n\nSource: ${p.sources.find(s => s.id === r.walkthrough!.sourceId)?.url}` : "";
  return `# ${p.title}\n\n${p.authors} · ${p.year}\nhttps://arxiv.org/abs/${p.id}\n\n${sections}${equations ? "\n\n## The mechanism in math\n" + equations : ""}${walkthrough}\n\n${r ? `Provenance: ${r.provenance}; ${r.evidenceScope}` : ""}\n\n## Sources\n${p.sources.map((s) => `- [${s.label}](${s.url})`).join("\n")}`;
}
