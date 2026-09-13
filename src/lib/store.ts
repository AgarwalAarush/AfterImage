import { initialState } from "./catalog";
import type { AppState } from "./types";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { storageRequest } from "./storage-request";
export { publicState } from "./public-state";
let local: DatabaseSync | undefined;
function db() {
  if (!local) {
    if (process.env.VERCEL)
      throw new Error("Production storage is not configured.");
    mkdirSync(".data", { recursive: true });
    local = new DatabaseSync(path.resolve(".data/afterimage.sqlite"));
    local.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)",
    );
    local
      .prepare("INSERT OR IGNORE INTO state VALUES(1,0,?)")
      .run(JSON.stringify(initialState()));
  }
  return local;
}
const remote = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
async function rest(route: string, init?: RequestInit) {
  const r = await storageRequest(`${process.env.SUPABASE_URL}/rest/v1/${route}`, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  return r;
}
export async function snapshot(): Promise<{ version: number; data: AppState }> {
  if (remote()) {
    const rows = await (
      await rest("afterimage_state?id=eq.1&select=version,data")
    ).json();
    if (!rows[0]) {
      await rest("afterimage_state?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ id: 1, version: 0, data: initialState() }),
      });
      return snapshot();
    }
    return rows[0];
  }
  const row = db().prepare("SELECT * FROM state WHERE id=1").get() as {
    version: number;
    data: string;
  };
  return { version: row.version, data: JSON.parse(row.data) };
}
export async function mutate<T>(fn: (state: AppState) => T): Promise<T> {
  for (let i = 0; i < 12; i++) {
    const { data, version } = await snapshot();
    const previous = JSON.stringify(data);
    const result = fn(data);
    if (JSON.stringify(data) === previous) return result;
    if (remote()) {
      const r = await rest(`afterimage_state?id=eq.1&version=eq.${version}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ data, version: version + 1 }),
      });
      if ((await r.json()).length) return result;
    } else {
      const r = db()
        .prepare("UPDATE state SET data=?,version=? WHERE id=1 AND version=?")
        .run(JSON.stringify(data), version + 1, version);
      if (Number(r.changes)) return result;
    }
  }
  throw new Error("Another change is being saved. Please try again.");
}

/** Poll only conversation data; paper source text never travels with streaming updates. */
export async function assistantSnapshot(): Promise<import("./assistant").AssistantRequest[]> {
  if (!remote()) return (await snapshot()).data.assistantRequests || [];
  const rows = await (await rest("afterimage_state?id=eq.1&select=requests:data->assistantRequests")).json();
  return rows[0]?.requests || [];
}
