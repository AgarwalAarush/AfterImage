"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Mark } from "./app-mark";
import { ThemeControl } from "./theme-control";

export function Login() {
  const [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="login-wrap">
      <div className="login-theme"><ThemeControl /></div>
      <Link className="brand" href="/">
        <Mark />
        <span>afterimage.</span>
      </Link>
      <form
        className="panel login-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            router.replace("/");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>
          A little less
          <br />
          forgotten.
        </h1>
        <p>
          Welcome back to your papers, your questions, and the ideas that stay.
        </p>
        <label>
          Access key
          <input
            type="password"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="button primary full">
          {busy ? "Opening…" : "Open my library"}
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
