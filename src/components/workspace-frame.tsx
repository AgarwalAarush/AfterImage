"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Bookmark, BookOpen, Compass, Files, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import type { AppState } from "@/lib/types";
import { Mark } from "./app-mark";
import { LibraryContent } from "./library-content";
import { LoadingStatus } from "./loading-status";
import { ThemeControl } from "./theme-control";

type WorkspaceFrameProps = {
  navigationExpanded: boolean;
  toggleNavigation: () => void;
  pathname: string;
  setPaletteOpen: (open: boolean) => void;
  state: AppState | null;
  error: string;
  refresh: () => Promise<void>;
  children: ReactNode;
};

export function WorkspaceFrame({ navigationExpanded, toggleNavigation, pathname, setPaletteOpen, state, error, refresh, children }: WorkspaceFrameProps) {
  return (
      <div className="app-shell" data-navigation-expanded={navigationExpanded}>
      <aside className="site-sidebar" aria-label="Workspace navigation">
        <div className="sidebar-brand">
          <button className="sidebar-toggle" onClick={toggleNavigation} aria-label={navigationExpanded ? "Collapse navigation" : "Expand navigation"} aria-expanded={navigationExpanded} aria-controls="workspace-navigation" title={navigationExpanded ? "Collapse navigation" : "Expand navigation"}>
            <span className="sidebar-mark"><Mark /></span>
            <span className="sidebar-toggle-icon">{navigationExpanded ? <PanelLeftClose size={21}/> : <PanelLeftOpen size={21}/>}</span>
          </button>
          {navigationExpanded && <Link href="/" className="brand">afterimage<span className="brand-dot">.</span></Link>}
        </div>
        <nav id="workspace-navigation" aria-label="Main navigation">
          {[
            {href:"/", label:"For you", Icon:Compass},
            {href:"/library", label:"Library", Icon:Bookmark},
            {href:"/subjects", label:"Subjects", Icon:BookOpen},
            {href:"/documents", label:"Documents", Icon:Files},
          ].map(({href,label,Icon}) => {
            const active=pathname===href || (href==="/library" && pathname.startsWith("/papers/")) || (["/documents","/subjects"].includes(href) && pathname.startsWith(href+"/"));
            return <Link key={href} href={href} className={active?"active":""} aria-current={active?"page":undefined} aria-label={label} title={navigationExpanded?undefined:label}><Icon size={20}/><span>{label}</span></Link>;
          })}
          <button onClick={()=>setPaletteOpen(true)} aria-label="Add a paper" title={navigationExpanded?undefined:"Add a paper"}><Plus size={20}/><span>Add a paper</span></button>
        </nav>
        <div className="sidebar-appearance"><ThemeControl /></div>
      </aside>
      <main>
        <LibraryContent loaded={pathname.startsWith("/documents") || pathname.startsWith("/subjects") || !!state} error={pathname.startsWith("/documents") || pathname.startsWith("/subjects") ? "" : error} retry={refresh} loading={
          <div className="loading-state">
            <Mark />
            <LoadingStatus label="Opening your reading desk" detail="Fetching your private library. This is taking longer than usual; the connection will time out and offer a retry." />
            <div className="skeleton" />
          </div>
        }>{children}</LibraryContent>
      </main>
      <footer className="site-footer">
        <span>
          <span className="footer-mark">◌</span> A little less forgotten.
        </span>
        <span className="eyebrow">YOUR PERSONAL RESEARCH COMPANION</span>
      </footer>
      </div>
  );
}
