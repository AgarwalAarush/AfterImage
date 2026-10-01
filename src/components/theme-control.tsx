"use client";
import { useEffect, useRef, useState } from "react";
import { SunMoon } from "lucide-react";
import { THEME_STORAGE_KEY, themePreference, type ThemePreference } from "@/lib/theme";

export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const current = useRef<ThemePreference>("system");
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    try { current.current = themePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch {}
    const apply = () => {
      document.documentElement.dataset.theme = current.current === "system" ? (system.matches ? "dark" : "light") : current.current;
      setPreference(current.current);
    };
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        current.current = themePreference(event.newValue);
        apply();
      }
    };
    apply();
    system.addEventListener("change", apply);
    window.addEventListener("storage", sync);
    return () => {
      system.removeEventListener("change", apply);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return <label className="theme-control">
    <SunMoon size={16} aria-hidden="true" />
    <span className="sr-only">Appearance</span>
    <select value={preference} onChange={event => {
      const next = themePreference(event.target.value);
      current.current = next;
      setPreference(next);
      document.documentElement.dataset.theme = next === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : next;
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
    }}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
