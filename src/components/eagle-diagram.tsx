const ink = "#38353f", muted = "#706979", accent = "#8068be";
export const eagleCaption = "One branch shown: real target features start the draft; later steps reuse draft states and sampled tokens. EAGLE-3 trains on these same kinds of inputs. The full method builds and verifies a dynamic tree.";

/** Original teaching diagram, checked against EAGLE-3 sections 2.1 and 3, Figure 5. */
export function EagleDiagram({ thumbnail = false }: { thumbnail?: boolean }) {
  const text = (x: number, y: number, value: string, heading = false, size = 14) => (
    <text x={x} y={y} fill={heading ? accent : ink}
      fontFamily={heading ? "Departure Mono" : "IBM Plex Mono"} fontSize={size}>{value.split(/(_(?:can|do|I))\b/).map((part, i) => part.startsWith("_") ? <tspan key={i} baselineShift="sub" fontSize="75%">{part.slice(1)}</tspan> : <tspan key={i}>{part}</tspan>)}</text>
  );
  const box = (x: number, y: number, w: number, h: number, active = false) => (
    <rect x={x} y={y} width={w} height={h} rx={10} fill={active ? "#f0ebf8" : "#fdfcfe"}
      stroke={active ? accent : "#d7d2de"} strokeWidth={1.4} />
  );
  const arrow = (d: string) => <path data-connector="true" d={d} fill="none" stroke={accent} strokeWidth={1.6} />;
  const description = "A target pass supplies fused features and the token I. The draft produces state a_I and token do, then reuses a_I with the embedding of do to predict it. Target verification follows. Training also feeds back draft states, with token prediction supervision and no feature matching loss.";
  return <div className={`diagram eagle-diagram ${thumbnail ? "thumbnail" : ""}`}>
    <svg className="graphic-desktop" viewBox="0 0 900 470" role="img" aria-label={description}>
      <title>Train the drafter on the states it actually uses</title>
      {text(24, 28, "TEACH THE DRAFTER TO CONTINUE ITS OWN WORK", true)}
      <text x={24} y={54} fill={muted} fontFamily="IBM Plex Mono" fontSize={12}>ONE INFERENCE BRANCH · example prefix: “How can I”</text>
      {box(24, 82, 252, 160)}
      {text(42, 111, "01 · START FROM THE TARGET", true, 12)}
      {text(42, 146, "Low / mid / high features")}
      {text(42, 170, "Fuse into one vector g_can")}
      {text(42, 211, "+ embedding of token “I”")}
      {arrow("M279 163H308M301 158L308 163L301 168")}
      {box(316, 82, 252, 160, true)}
      {text(334, 111, "02 · FIRST DRAFT STEP", true, 12)}
      {text(334, 146, "Decoder → state a_I")}
      {text(334, 170, "LM head → sample “do”")}
      {text(334, 211, "Keep the state AND token")}
      {arrow("M571 163H600M593 158L600 163L593 168")}
      {box(608, 82, 268, 160, true)}
      {text(626, 111, "03 · NEXT DRAFT STEP", true, 12)}
      {text(626, 146, "a_I + embedding of “do”")}
      {text(626, 170, "Decoder → state a_do")}
      {text(626, 211, "LM head → sample “it”")}
      {arrow("M742 245V269M737 262L742 269L747 262")}
      {box(24, 278, 852, 78)}
      {text(42, 304, "TARGET VERIFICATION · WEIGHTS STAY FIXED", true, 12)}
      {text(42, 332, "Score candidates together; accept in order. Correct a rejection and discard later drafts.", false, 13)}
      {box(24, 380, 852, 72, true)}
      {text(42, 405, "TRAINING-TIME TEST · REHEARSE THE SAME STATE REUSE", true, 12)}
      {text(42, 433, "Train token prediction on these rollout inputs. Remove the target-feature matching loss.", false, 13)}
    </svg>
    {!thumbnail && <svg className="graphic-mobile" viewBox="0 0 350 778" role="img" aria-label={description}>
      <title>How EAGLE-3 drafts and learns</title>
      {text(10, 24, "LEARN TO CONTINUE YOUR OWN DRAFT", true, 11)}
      {text(10, 49, "One branch: “How can I …”", false, 12)}
      {box(10, 72, 330, 135)}
      {text(28, 100, "01 · START FROM THE TARGET", true, 12)}
      {text(28, 130, "Low / mid / high → fuse g_can")}
      {text(28, 156, "+ embedding of token “I”")}
      {text(28, 183, "Reuse a completed target pass", false, 12)}
      {arrow("M175 210V228M170 221L175 228L180 221")}
      {box(10, 238, 330, 123, true)}
      {text(28, 266, "02 · FIRST DRAFT STEP", true, 12)}
      {text(28, 297, "Decoder → state a_I")}
      {text(28, 324, "LM head → sample token “do”")}
      {arrow("M175 364V382M170 375L175 382L180 375")}
      {box(10, 392, 330, 135, true)}
      {text(28, 420, "03 · REUSE STATE AND TOKEN", true, 12)}
      {text(28, 451, "a_I + embedding of “do”")}
      {text(28, 477, "Decoder → state a_do")}
      {text(28, 503, "LM head → sample token “it”")}
      {arrow("M175 530V548M170 541L175 548L180 541")}
      {box(10, 558, 330, 92)}
      {text(28, 585, "TARGET VERIFIES THE DRAFT", true, 12)}
      {text(28, 611, "Score together; accept in order.", false, 12)}
      {text(28, 634, "Correct rejected proposals.", false, 12)}
      {box(10, 674, 330, 92, true)}
      {text(28, 701, "TRAINING-TIME TEST", true, 12)}
      {text(28, 727, "Train on reused draft states too.", false, 12)}
      {text(28, 750, "Token loss; no feature matching.", false, 12)}
    </svg>}
  </div>;
}
