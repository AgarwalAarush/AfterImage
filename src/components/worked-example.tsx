"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { examplePlayback, type WorkedExample } from "@/lib/worked-examples";
import styles from "./worked-example.module.css";

export function WorkedExampleAnimation({example, fallback}: {example: WorkedExample; fallback: ReactNode}) {
  const host = useRef<HTMLDivElement>(null);
  const toggle = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const controller = new AbortController();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let animated: SVGSVGElement | undefined, poster: SVGSVGElement | undefined, current: SVGSVGElement | undefined;
    let visible = false, userPaused = false, explicitPlay = false, printing = false;
    const theme = () => {
      const colors = getComputedStyle(root);
      for (const svg of [animated, poster]) for (const token of ["surface", "ink", "muted", "line", "accent", "panel"]) {
        svg?.style.setProperty("--" + token, colors.getPropertyValue("--worked-" + token));
      }
    };
    const sync = () => {
      if (!animated || !poster || controller.signal.aborted) return;
      const state = examplePlayback({reduced: reduced.matches, explicitPlay, userPaused, visible, hidden: document.hidden, printing});
      const desired = state.poster ? poster : animated;
      if (current !== desired) {
        current?.pauseAnimations();
        current = desired;
        root.replaceChildren(current);
        current.pauseAnimations();
      }
      current.dataset.playing = String(state.playing);
      if (state.playing) current.unpauseAnimations(); else current.pauseAnimations();
      setPlaying(state.playing);
    };
    toggle.current = () => {userPaused = current?.dataset.playing === "true"; explicitPlay = !userPaused; sync();};
    const onReduced = () => {explicitPlay = false; sync();};
    const beforePrint = () => {printing = true; sync();};
    const afterPrint = () => {printing = false; sync();};
    const visibility = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; sync();}, {threshold: .1});
    visibility.observe(root);
    const appearance = new MutationObserver(theme);
    appearance.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme", "class", "style"]});
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", onReduced);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    setReady(false);
    setPlaying(false);
    // Asset names come exclusively from the curated registry, never library/model data.
    Promise.all(["", "-poster"].map(async suffix => {
      const response = await fetch(`/worked-examples/${example.slug}${suffix}.svg`, {signal: controller.signal});
      if (!response.ok) throw new Error("Example unavailable");
      const doc = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
      if (doc.querySelector("parsererror, script, foreignObject, image") || doc.documentElement.localName !== "svg") throw new Error("Invalid example");
      if (Array.from(doc.querySelectorAll("*")).some(node => Array.from(node.attributes).some(a => /^on/i.test(a.name)))) throw new Error("Invalid example attributes");
      return document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
    })).then(assets => {
      if (controller.signal.aborted) return;
      [animated, poster] = assets;
      theme(); sync(); setReady(true);
    }).catch(() => { /* Keep the original worked prose when an asset cannot load. */ });
    return () => {
      controller.abort(); toggle.current = null;
      visibility.disconnect(); appearance.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", onReduced);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      current?.pauseAnimations(); root.replaceChildren();
    };
  }, [example.slug]);
  return <div className={styles.example} data-worked-example={example.slug}>
    {ready ? <p className={styles.intro}>{example.intro}</p> : fallback}
    <div ref={host} className={styles.drawing} aria-busy={!ready} />
    {ready && <div className={styles.footer}>
      <p className={styles.caption}>{example.caption} <a href={example.sourceUrl} target="_blank" rel="noreferrer">{example.sourceLabel} ↗</a></p>
      <button type="button" className={styles.control} aria-label={playing ? "Pause explanation" : "Play explanation"} onClick={() => toggle.current?.()}>
        {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}<span>{playing ? "Pause" : "Play"}</span>
      </button>
    </div>}
  </div>;
}
