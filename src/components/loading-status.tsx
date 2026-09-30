"use client";
import { useEffect, useState } from "react";

export function LoadingStatus({label, detail}: {label: string; detail: string}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return <div role="status" className="loading-status">
    <p className="eyebrow">{label}</p>
    {seconds >= 4 && <p className="loading-detail">{detail}</p>}
    {seconds >= 4 && <span className="eyebrow" aria-live="off">{seconds}s elapsed</span>}
  </div>;
}
