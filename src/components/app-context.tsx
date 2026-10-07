"use client";
import { createContext, useContext } from "react";
import type { AppState } from "@/lib/types";
import type { PreparationRequest } from "@/lib/generation-progress";

export const AppContext = createContext<{
  state: AppState | null;
  act: (body: Record<string, unknown>) => Promise<any>;
  prepareKit: (paperId: string, action?: "generate" | "study") => Promise<void>;
  preparations: Record<string, PreparationRequest>;
  busy: boolean;
  refresh: () => Promise<void>;
  refreshing: boolean;
  openAdd: () => void;
  toast: (s: string, action?: {label: string; run: () => void}) => void;
}>({
  state: null,
  act: async () => {},
  prepareKit: async () => {},
  preparations: {},
  busy: false,
  refresh: async () => {},
  refreshing: false,
  openAdd: () => {},
  toast: () => {},
});
export const useApp = () => useContext(AppContext);
