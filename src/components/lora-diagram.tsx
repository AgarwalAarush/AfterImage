import { diagramPaint } from "@/lib/diagram-theme";
const ink = "#363b37",
  muted = "#6e766f",
  accent = "#648775",
  line = "#b5bdb7";
export function LoraDiagram({ thumbnail = false }: { thumbnail?: boolean }) {
  const text = (x: number, y: number, s: string, kind = "label") => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={diagramPaint(kind === "meta" ? muted : ink, "fill", true)}
      className={`diagram-${kind}`}
    >
      {s.includes("₀") ? s.split("₀").map((part, i) => (
        <tspan key={i}>
          {i > 0 && <tspan baselineShift="sub" fontSize="70%">0</tspan>}
          {part}
        </tspan>
      )) : s}
    </text>
  );
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    active = false,
  ) => (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="8"
        fill={diagramPaint(active ? "#edf3ee" : "#fcfcfb", "fill")}
        stroke={diagramPaint(active ? accent : line, "stroke")}
        strokeWidth="1.4"
      />
      {text(x + w / 2, y + h / 2 + 5, label)}
    </g>
  );
  return (
    <div className={`diagram lora-diagram ${thumbnail ? "thumbnail" : ""}`}>
      <svg
        className="graphic-desktop"
        viewBox="0 0 940 390"
        role="img"
        aria-label="LoRA adds a low-rank branch alongside frozen weights. The input passes through A, then B, and the two branch outputs are added."
      >
        <title>Train a low-rank update beside a frozen model</title>
        <defs>
          <marker
            id="lora-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0 0L6 3L0 6" fill={diagramPaint("none", "fill")} stroke={diagramPaint(accent, "stroke")} />
          </marker>
        </defs>
        {text(470, 27, "A SMALL UPDATE, ALONGSIDE THE FROZEN MODEL", "heading")}
        <g fill={diagramPaint("none", "fill")} stroke={diagramPaint(line, "stroke")} strokeWidth="1.5">
          <path d="M137 194H205V109H270" />
          <path d="M205 194V275H310" />
          <path d="M380 109H455" markerEnd="url(#lora-arrow)" />
          <path d="M565 109H700V169" markerEnd="url(#lora-arrow)" />
          <path d="M550 275H700V220" markerEnd="url(#lora-arrow)" />
          <path d="M725 194H820" markerEnd="url(#lora-arrow)" />
        </g>
        {box(57, 165, 80, 58, "x")}
        {box(270, 79, 110, 60, "A", true)}
        {box(455, 79, 110, 60, "B", true)}
        {box(310, 240, 240, 70, "W₀", false)}
        <circle cx="205" cy="194" r="3" fill={diagramPaint(line, "fill")} />
        <circle
          cx="700"
          cy="194"
          r="25"
          fill={diagramPaint("white", "fill")}
          stroke={diagramPaint(accent, "stroke")}
          strokeWidth="1.5"
        />
        {text(700, 200, "+")}
        {text(325, 160, "PROJECT DOWN · k → r", "meta")}
        {text(510, 160, "PROJECT UP · r → d", "meta")}
        {text(430, 335, "FROZEN · d × k", "meta")}
        {text(98, 249, "INPUT · k", "meta")}
        {text(820, 165, "W₀x + BAx", "equation")}
        {text(817, 223, "OUTPUT · d", "meta")}
        {text(
          470,
          378,
          "ONLY A AND B LEARN · r ≪ min(d, k) · SCALING OMITTED",
          "footer",
        )}
      </svg>
      {!thumbnail && (
        <svg
          className="graphic-mobile"
          viewBox="0 0 390 510"
          role="img"
          aria-label="Two parallel branches: train A then B, keep W zero fixed, and add their outputs."
        >
          <title>LoRA: parallel frozen and trainable branches</title>
          {text(195, 24, "TRAIN THE UPDATE, KEEP THE BASE", "heading")}
          <g fill={diagramPaint("none", "fill")} stroke={diagramPaint(line, "stroke")} strokeWidth="1.5">
            <path d="M195 102V126H97V157 M195 126H287V210 M97 210V260 M97 313V370H172 M287 280V370H218 M195 393V433" />
          </g>
          {box(155, 49, 80, 53, "x")}
          {box(50, 157, 94, 53, "A", true)}
          {box(50, 260, 94, 53, "B", true)}
          {box(239, 210, 94, 70, "W₀")}
          <circle
            cx="195"
            cy="370"
            r="23"
            fill={diagramPaint("white", "fill")}
            stroke={diagramPaint(accent, "stroke")}
            strokeWidth="1.5"
          />
          {text(195, 376, "+")}
          {text(153, 237, "k → r", "meta")}
          {text(151, 339, "r → d", "meta")}
          {text(335, 308, "FROZEN", "meta")}
          {text(195, 459, "W₀x + BAx", "equation")}
          {text(
            195,
            495,
            "TWO PATHS · ONLY THE LOW-RANK PATH LEARNS",
            "footer",
          )}
        </svg>
      )}
    </div>
  );
}
