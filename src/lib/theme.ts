export type ThemePreference = "system" | "light" | "dark";
export const THEME_STORAGE_KEY = "afterimage-theme";
export function themePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
// Runs before the first paint. Storage can be unavailable in private contexts.
export const themeBootstrap = `(()=>{let theme='system';try{theme=localStorage.getItem('${THEME_STORAGE_KEY}')||theme}catch{}document.documentElement.dataset.theme=theme==='light'||theme==='dark'?theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`;
