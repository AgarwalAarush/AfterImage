"use client";
import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppState } from "@/lib/types";
import type { PreparationRequest } from "@/lib/generation-progress";
import { clientRequest } from "@/lib/client-request";
import { readLibraryUpdate, SessionExpired } from "@/lib/library-client";
import { AppContext } from "./app-context";
import { AppNotifications, useAppNotifications } from "./app-notifications";
import { PaperPalette } from "./paper-palette";
import { WorkspaceFrame } from "./workspace-frame";

export { useApp } from "./app-context";
export { Mark } from "./app-mark";

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [preparations, setPreparations] = useState<Record<string, PreparationRequest>>({}),
    [paletteOpen, setPaletteOpen] = useState(false);
  const notifications = useAppNotifications();
  const {toast, clearNotifications} = notifications;
  const [navigationExpanded, setNavigationExpanded] = useState(false);
  useEffect(() => { try { setNavigationExpanded(localStorage.getItem("afterimage-navigation-expanded") === "true"); } catch {} }, []);
  function toggleNavigation() { setNavigationExpanded(value => { const next = !value; try { localStorage.setItem("afterimage-navigation-expanded", String(next)); } catch {} return next; }); }
  const router = useRouter(),
    pathname = usePathname();
  const stateRef = useRef<AppState | null>(null),
    requestRef = useRef<AbortController | null>(null),
    busyRef = useRef(false),
    versionRef = useRef<number | null>(null),
    lastLoaded = useRef(0);
  const preparationRequests = useRef(new Map<string, Promise<void>>());
  const refresh = useCallback(async () => {
    if (busyRef.current || (requestRef.current && !requestRef.current.signal.aborted)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setError("");
    try {
      const {state: data, version, workerSeenAt} = await readLibraryUpdate(
        controller.signal, stateRef.current && versionRef.current !== null ? versionRef.current : undefined,
      );
      if (controller.signal.aborted) return;
      versionRef.current = version;
      lastLoaded.current = Date.now();
      if (data) {
        stateRef.current = data;
        setState(data);
        // A successful read reconciles an uncertain write; never replay it.
        setPreparations(current => Object.fromEntries(Object.entries(current).filter(([, request]) => request.status === "submitting")));
      } else if (stateRef.current && stateRef.current.workerSeenAt !== workerSeenAt) {
        stateRef.current = {...stateRef.current, workerSeenAt};
        setState(stateRef.current);
      }
      setError("");
    } catch (e) {
      if (controller.signal.aborted) return;
      if (e instanceof SessionExpired) {
        stateRef.current = null;
        versionRef.current = null;
        setState(null);
        router.replace("/login");
      } else setError((e as Error).message);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setRefreshing(false); }
    }
  }, [router]);
  useEffect(() => {
    if (pathname === "/login") {
      requestRef.current?.abort();
      stateRef.current = null;
      versionRef.current = null;
      lastLoaded.current = 0;
      setState(null);
      setError("");
      setPreparations({});
      clearNotifications();
    } else if (!pathname.startsWith("/documents") && !pathname.startsWith("/subjects") && (!stateRef.current || Date.now() - lastLoaded.current > 30000)) void refresh();
  }, [refresh, pathname, clearNotifications]);
  useEffect(() => () => { requestRef.current?.abort(); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (pathname === "/login") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pathname]);
  const activeJobs = state?.jobs.some(j => ["queued", "running"].includes(j.status)) || false;
  useEffect(() => {
    if (pathname === "/login" || pathname.startsWith("/documents") || pathname.startsWith("/subjects")) return;
    const poll = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh();
    };
    const resume = () => { if (Date.now() - lastLoaded.current > 10000) poll(); };
    const t = setInterval(poll, activeJobs ? 5000 : error ? 15000 : 60000);
    window.addEventListener("online", poll);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", poll);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh, activeJobs, pathname, error]);
  const act = useCallback(async (body: Record<string, unknown>) => {
    busyRef.current = true;
    requestRef.current?.abort();
    setBusy(true);
    try {
      const r = await clientRequest("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        stateRef.current = null;
        versionRef.current = null;
        setState(null);
        router.replace("/login");
        throw new Error("Please sign in again.");
      }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      stateRef.current = data.state;
      versionRef.current = null;
      lastLoaded.current = Date.now();
      setState(data.state);
      setError("");
      return data;
    } catch (e) {
      toast((e as Error).message);
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [router, toast]);
  const prepareKit = useCallback((paperId: string, action: "generate" | "study" = "generate") => {
    const pending = preparationRequests.current.get(paperId);
    if (pending) return pending;
    if (stateRef.current?.jobs.some(job => job.paperId === paperId && job.type === action && ["queued", "running"].includes(job.status))) return Promise.resolve();
    const startedAt = new Date().toISOString();
    setPreparations(current => ({...current, [paperId]: {status: "submitting", startedAt}}));
    const request = act({action, paperId}).then(() => {
      setPreparations(current => {
        const next = {...current};
        delete next[paperId];
        return next;
      });
    }).catch((cause: Error) => {
      versionRef.current = null;
      setPreparations(current => ({...current, [paperId]: {status: "unconfirmed", startedAt, message: cause.message}}));
    }).finally(() => preparationRequests.current.delete(paperId));
    preparationRequests.current.set(paperId, request);
    return request;
  }, [act]);
  if (pathname === "/login") return children;
  return (
    <AppContext.Provider
      value={{
        state,
        act,
        prepareKit,
        preparations,
        busy,
        refresh,
        refreshing,
        openAdd: () => setPaletteOpen(true),
        toast,
      }}
    >
      <WorkspaceFrame navigationExpanded={navigationExpanded} toggleNavigation={toggleNavigation} pathname={pathname}
        setPaletteOpen={setPaletteOpen} state={state} error={error} refresh={refresh}>{children}</WorkspaceFrame>
      <AppNotifications notifications={notifications} busy={busy} />
      {paletteOpen && <PaperPalette close={() => setPaletteOpen(false)} />}
    </AppContext.Provider>
  );
}
