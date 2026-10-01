"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, themePreference, type ThemePreference } from "@/lib/theme";

export function ThemeControl() {
  const id = useId();
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

  return <fieldset className="theme-control">
    <legend className="sr-only">Appearance</legend>
    {([
      { value: "system", label: "System", Icon: Monitor },
      { value: "light", label: "Light", Icon: Sun },
      { value: "dark", label: "Dark", Icon: Moon },
    ] as const).map(({ value, label, Icon }) => (
      <label className="theme-choice" key={value} title={value === "system" ? "System appearance · follows your device" : `${label} appearance`}>
        <input
          type="radio"
          name={`appearance-${id}`}
          value={value}
          checked={preference === value}
          onChange={() => {
            current.current = value;
            setPreference(value);
            document.documentElement.dataset.theme = value === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
            try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch {}
          }}
        />
        <span className="theme-choice-face"><Icon size={15} strokeWidth={1.75} aria-hidden="true" /></span>
        <span className="sr-only">{label}</span>
      </label>
    ))}
  </fieldset>;
}
