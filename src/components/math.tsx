import katex from "katex";
import { Fragment } from "react";
export function MathText({
  latex,
  display = false,
}: {
  latex: string;
  display?: boolean;
}) {
  try {
    const html = katex.renderToString(latex, {
      displayMode: display,
      throwOnError: true,
      trust: false,
      strict: "error",
      maxExpand: 500,
      output: "htmlAndMathml",
    });
    return (
      <span
        className={display ? "math-display" : "math-inline"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <code className="math-fallback">{latex}</code>;
  }
}
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\$[^$\n]+\$|\\\([\s\S]*?\\\))/g)
        .map((part, i) =>
          part.startsWith("$") ? (
            <MathText key={i} latex={part.slice(1, -1)} />
          ) : part.startsWith("\\(") ? (
            <MathText key={i} latex={part.slice(2, -2)} />
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
    </>
  );
}
export function RecallText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>
            <InlineText text={p} />
          </p>
        ))}
    </>
  );
}
