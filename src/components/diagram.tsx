import type { Paper } from "@/lib/types";
import { sceneSvg, sceneSvgMobile } from "@/lib/scene";
import { LoraDiagram } from "./lora-diagram";
import { EagleDiagram } from "./eagle-diagram";
const colors = {
  violet: "#8068be",
  sage: "#6d927f",
  blue: "#638eae",
  ochre: "#bc974c",
};
const textStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  letterSpacing: ".045em",
};
export function Diagram({
  paper,
  thumbnail = false,
}: {
  paper: Paper;
  thumbnail?: boolean;
}) {
  const c = colors[paper.accent],
    light = c + "1a";
  if (paper.id === "2503.01840") return <EagleDiagram thumbnail={thumbnail} />;
  if (paper.visual === "lora") return <LoraDiagram thumbnail={thumbnail} />;
  if (paper.scene) {
    try {
      return (
        <div className={`diagram generated ${thumbnail ? "thumbnail" : ""}`}>
          <div
            className="scene-wide"
            dangerouslySetInnerHTML={{ __html: sceneSvg(paper.scene, c) }}
          />
          {!thumbnail && (
            <div
              className="scene-mobile"
              dangerouslySetInnerHTML={{
                __html: sceneSvgMobile(paper.scene, c),
              }}
            />
          )}
        </div>
      );
    } catch {
      return (
        <div className="diagram-unavailable">
          This diagram needs another layout pass.
        </div>
      );
    }
  }
  if (!paper.visual)
    return (
      <div className="diagram thumbnail diagram-pending">
        <span>◌</span>
        <small>
          {["queued", "running"].includes(paper.generationStatus)
            ? "NOTECARD IN THE MAKING"
            : "A NEW THREAD TO FOLLOW"}
        </small>
      </div>
    );
  const kind = paper.visual;
  const label = (x: number, y: number, t: string, muted = true) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={muted ? "#8a8884" : "#343530"}
      style={textStyle}
    >
      {t}
    </text>
  );
  const node = (
    x: number,
    y: number,
    w: number,
    h: number,
    t: string,
    active = true,
  ) => (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        fill={active ? light : "#fbfbfa"}
        stroke={active ? c : "#d9d8d4"}
        strokeWidth="1.4"
      />
      {label(x + w / 2, y + h / 2 + 4, t, !active)}
    </g>
  );
  return (
    <div className={`diagram ${thumbnail ? "thumbnail" : ""}`}>
      <svg
        className="graphic-desktop"
        viewBox="0 0 760 330"
        role="img"
        aria-label={paper.recall?.idea || paper.title}
      >
        <title>{paper.recall?.idea || paper.title}</title>
        {kind === "experts" && (
          <>
            <path
              d="M90 150 H240 M330 150 C390 150 350 82 421 82 M330 150 C390 150 440 222 482 222"
              fill="none"
              stroke={c}
              strokeWidth="1.8"
              strokeDasharray="5 5"
            />
            {node(48, 119, 84, 62, "TOKEN")}
            {node(236, 111, 100, 78, "ROUTER")}
            {Array.from({ length: 8 }, (_, i) => {
              const x = 410 + (i % 4) * 72,
                y = 62 + Math.floor(i / 4) * 135,
                active = i === 0 || i === 5;
              return (
                <g key={i}>
                  {node(x, y, 53, 50, `E${i + 1}`, active)}
                  {active && <circle cx={x + 26} cy={y + 65} r="3" fill={c} />}
                </g>
              );
            })}
            {label(286, 214, "TOP-2 SELECTION")}
            {label(543, 295, "8 EXPERTS · 2 ACTIVE")}
            {label(90, 213, "ONE TOKEN")}
          </>
        )}
        {kind === "attention" && (
          <>
            {["The", "idea", "stays"].map((t, i) => (
              <g key={t}>
                {node(90 + i * 240, 229, 100, 43, t, i === 1)}
                {[0, 1, 2].map((j) => (
                  <path
                    key={j}
                    d={`M380 98 Q${140 + j * 240} ${80 + i * 25} ${140 + i * 240} 219`}
                    fill="none"
                    stroke={c}
                    strokeWidth={i === 1 ? 2 : 1.2}
                    opacity={i === 1 ? 0.8 : 0.25}
                  />
                ))}
              </g>
            ))}
            <circle
              cx="380"
              cy="85"
              r="38"
              fill={light}
              stroke={c}
              strokeWidth="1.5"
            />
            {label(380, 89, "CONTEXT", false)}
            {label(380, 309, "COMPARE QUERIES & KEYS · MIX VALUES")}
          </>
        )}
        {kind === "contrastive" && (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                {label(167, 110 + i * 62, `IMAGE ${i + 1}`)}
                {label(290 + i * 125, 52, `TEXT ${i + 1}`)}
                {[0, 1, 2].map((j) => (
                  <g key={j}>
                    <path
                      d={`M${237 + j * 125} ${80 + i * 62} l10 -9 h106 l-10 9 Z`}
                      fill={i === j ? c + "25" : "#f0f1f3"}
                      stroke={i === j ? c : "#d6d8df"}
                    />
                    <rect
                      x={237 + j * 125}
                      y={80 + i * 62}
                      width="106"
                      height="45"
                      fill={i === j ? light : "#f7f7f8"}
                      stroke={i === j ? c : "#d6d8df"}
                    />
                    {i === j && (
                      <circle
                        cx={290 + j * 125}
                        cy={102 + i * 62}
                        r="4"
                        fill={c}
                      />
                    )}
                  </g>
                ))}
              </g>
            ))}
            <path
              d="M290 102 L540 226"
              stroke={c}
              strokeDasharray="3 8"
              fill="none"
            />
            {label(405, 295, "MATCHED PAIRS COME CLOSER")}
          </>
        )}
        {kind === "pruning" && (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                {[0, 1, 2].map((j) => (
                  <g key={j}>
                    <path
                      d={`M${140} ${75 + i * 80} L${370} ${75 + j * 80} L620 ${155}`}
                      fill="none"
                      stroke={i === j ? c : "#dedddf"}
                      strokeWidth={i === j ? 2 : 1}
                      opacity={i === j ? 1 : 0.5}
                    />
                  </g>
                ))}
              </g>
            ))}
            {[140, 370].map((x) =>
              [75, 155, 235].map((y) => (
                <circle
                  key={`${x}-${y}`}
                  cx={x}
                  cy={y}
                  r="11"
                  fill="white"
                  stroke={c}
                  strokeWidth="1.5"
                />
              )),
            )}
            <circle
              cx="620"
              cy="155"
              r="16"
              fill={light}
              stroke={c}
              strokeWidth="1.5"
            />
            {node(244, 41, 63, 30, "θ₀", true)}
            {label(380, 293, "KEEP THE MASK + ORIGINAL INITIALIZATION")}
          </>
        )}
        {kind === "memory" && (
          <>
            <path
              d="M283 75 H467 V222 Q467 280 375 280 Q283 280 283 222 Z"
              fill={c + "08"}
              stroke="#a5a1ac"
              strokeWidth="1.4"
            />
            <path
              d="M284 186 Q330 174 376 187 T466 186 V222 Q466 279 375 279 Q284 279 284 222Z"
              fill={c + "30"}
            />
            {[0, 1, 2, 3].map((i) => (
              <circle
                key={i}
                cx={92 + i * 40}
                cy={170 - Math.sin(i) * 30}
                r={i % 2 ? 7 : 12}
                fill={i % 2 ? "white" : light}
                stroke={i % 2 ? "#d4d0da" : c}
                strokeWidth="1.5"
              />
            ))}
            <path
              d="M86 170 Q173 106 262 152 M523 121 L467 148"
              fill="none"
              stroke={c}
              strokeDasharray="4 6"
            />
            <circle
              cx="375"
              cy="75"
              r="29"
              fill="white"
              stroke={c}
              strokeWidth="1.8"
            />
            <path d="M359 75 H391 M375 46 V29" stroke={c} strokeWidth="1.8" />
            {node(526, 86, 81, 59, "xₜ")}
            {label(376, 146, "STATE h", false)}
            {label(374, 236, "SELECTED HISTORY")}
            {label(159, 231, "EARLIER CONTEXT")}
            {label(378, 309, "BOUNDED MEMORY · INPUT-DEPENDENT UPDATE")}
          </>
        )}
      </svg>
      {!thumbnail && (
        <svg
          className="graphic-mobile"
          viewBox="0 0 380 360"
          role="img"
          aria-label={paper.recall?.idea || paper.title}
        >
          <title>{paper.recall?.idea}</title>
          {node(
            114,
            27,
            152,
            52,
            kind === "experts"
              ? "TOKEN"
              : kind === "contrastive"
                ? "IMAGE + TEXT"
                : kind === "pruning"
                  ? "DENSE NETWORK"
                  : kind === "memory"
                    ? "CURRENT TOKEN"
                    : "QUERY + KEYS",
            false,
          )}
          <path
            d="M190 80 V129 M190 211 V268"
            fill="none"
            stroke={c}
            strokeDasharray="4 5"
            strokeWidth="1.5"
          />
          {node(
            66,
            130,
            248,
            80,
            kind === "experts"
              ? "ROUTER → TWO EXPERTS"
              : kind === "contrastive"
                ? "COMPARE ALL PAIRS"
                : kind === "pruning"
                  ? "PRUNE + RESET TO θ₀"
                  : kind === "memory"
                    ? "SELECT WHAT SURVIVES"
                    : "WEIGHTED VALUE MIX",
            true,
          )}
          {node(
            107,
            269,
            166,
            49,
            kind === "experts"
              ? "COMBINE OUTPUTS"
              : kind === "contrastive"
                ? "SHARED SPACE"
                : kind === "pruning"
                  ? "TRAIN THE TICKET"
                  : kind === "memory"
                    ? "UPDATED STATE"
                    : "CONTEXT",
            true,
          )}
        </svg>
      )}
    </div>
  );
}
