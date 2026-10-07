"use client";
import { useEffect } from "react";
import { ReadingClock, type EngagementProgress } from "@/lib/reading-engagement";
export function useReadingEngagement(paperId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const key = `afterimage-engagement:${paperId}`;
    const day = () => new Date().toISOString().slice(0,10);
    const active = () => document.visibilityState === "visible" && document.hasFocus();
    let progress: EngagementProgress = {day: day(),seconds: 0,submitted: false,eventId: crypto.randomUUID()};
    try {const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved?.day === progress.day && Number.isFinite(saved.seconds) && typeof saved.eventId === "string") progress = saved;
    } catch {}
    let clock = new ReadingClock(progress,performance.now(),active());
    const sample = (closing = false) => {
      const ready = clock.sample(performance.now(),!closing && active());
      if (clock.progress.day !== day()) clock = new ReadingClock({day: day(),seconds: 0,submitted: false,eventId: crypto.randomUUID()},performance.now(),!closing && active());
      else if (ready) {
        // Mark before writing: uncertain network outcomes are never replayed automatically.
        clock.progress.submitted = true;
        void fetch("/api/state",{method: "POST",headers: {"Content-Type":"application/json"},keepalive: true,
          body: JSON.stringify({action: "engagement",paperId,...clock.progress})}).catch(() => {});
      }
      try {sessionStorage.setItem(key,JSON.stringify(clock.progress));} catch {}
    };
    const update = () => sample();
    const close = () => sample(true);
    const timer = window.setInterval(update,1000);
    document.addEventListener("visibilitychange",update);
    window.addEventListener("focus",update); window.addEventListener("blur",update); window.addEventListener("pagehide",close);
    return () => {close();clearInterval(timer);document.removeEventListener("visibilitychange",update);
      window.removeEventListener("focus",update);window.removeEventListener("blur",update);window.removeEventListener("pagehide",close);};
  },[paperId,enabled]);
}
