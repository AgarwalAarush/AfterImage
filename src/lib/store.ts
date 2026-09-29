import { initialState } from "./catalog";
import type { AppState } from "./types";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { storageRequest } from "./storage-request";
import { currentState } from "./state-version";
import { macserverRequest } from "./macserver-client";
export { publicState } from "./public-state";
let local: DatabaseSync | undefined;
function db() {
  if (!local) {
    const configured = process.env.AFTERIMAGE_SQLITE_PATH;
    if (process.env.NODE_ENV === "production" &&
      (!configured || !path.isAbsolute(configured) || !existsSync(configured)))
      throw new Error("Production SQLite storage must point to an existing absolute file.");
    const file = configured || path.resolve(".data/afterimage.sqlite");
    mkdirSync(path.dirname(file), { recursive: true });
    local = new DatabaseSync(file);
    local.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)",
    );
    const columns = local.prepare("PRAGMA table_info(state)").all() as { name: string }[];
    if (!columns.some(column => column.name === "worker_seen_at")) {
      local.exec("ALTER TABLE state ADD COLUMN worker_seen_at TEXT");
      local.exec("UPDATE state SET worker_seen_at = json_extract(data, '$.workerSeenAt')");
    }
    local
      .prepare("INSERT OR IGNORE INTO state (id,version,data) VALUES(1,0,?)")
      .run(JSON.stringify(initialState()));
  }
  return local;
}
const remote = () => {
  const selected = process.env.AFTERIMAGE_STORAGE;
  if (selected === "macserver") return false;
  if (selected === "sqlite") {
    if (process.env.VERCEL) throw new Error("SQLite storage cannot run on Vercel.");
    return false;
  }
  if (selected && selected !== "supabase") throw new Error("Unknown storage mode.");
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  if (selected === "supabase" || process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw new Error("Production Supabase storage is not configured.");
  return false;
};
const macserver = () => process.env.AFTERIMAGE_STORAGE === "macserver";
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
  if (macserver()) return macserverRequest({ action: "snapshot" });
  if (remote()) {
    const rows = await (
      await rest("afterimage_state?id=eq.1&select=version,data,updated_at")
    ).json();
    if (!rows[0]) {
      await rest("afterimage_state?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ id: 1, version: 0, data: initialState() }),
      });
      return snapshot();
    }
    const data = currentState(rows[0].data);
    if (data.workerSeenAt && Date.parse(rows[0].updated_at) > Date.parse(data.workerSeenAt))
      data.workerSeenAt = rows[0].updated_at;
    return { version: rows[0].version, data };
  }
  const row = db().prepare("SELECT * FROM state WHERE id=1").get() as {
    version: number;
    data: string;
    worker_seen_at: string | null;
  };
  const data = currentState(JSON.parse(row.data));
  if (row.worker_seen_at && (!data.workerSeenAt || Date.parse(row.worker_seen_at) > Date.parse(data.workerSeenAt)))
    data.workerSeenAt = row.worker_seen_at;
  return { version: row.version, data };
}

/** The version and worker presence fit in a small response even when papers grow. */
export async function stateStatus(): Promise<{ version: number; workerSeenAt: string | null }> {
  if (macserver()) return macserverRequest({ action: "status" });
  if (!remote()) {
    const row = db().prepare("SELECT version, worker_seen_at FROM state WHERE id=1").get() as {version: number; worker_seen_at: string | null};
    return {version: row.version, workerSeenAt: row.worker_seen_at};
  }
  const rows = await (await rest("afterimage_state?id=eq.1&select=version,updated_at,seen:data->>workerSeenAt")).json();
  if (!rows[0]) return {version: (await snapshot()).version, workerSeenAt: null};
  return {version: rows[0].version, workerSeenAt: rows[0].seen && Date.parse(rows[0].updated_at) > Date.parse(rows[0].seen) ? rows[0].updated_at : rows[0].seen || null};
}

/** A worker can check for queued or expired jobs without downloading paper content. */
export async function workerClaimStatus(now = Date.now()): Promise<{claim: boolean; heartbeat: boolean}> {
  if (macserver()) return macserverRequest({ action: "workerClaimStatus" });
  if (!remote()) {
    const {data} = await snapshot();
    return workerClaimDecision(data.jobs, data.workerSeenAt, now);
  }
  const rows = await (await rest("afterimage_state?id=eq.1&select=jobs:data->jobs,seen:data->>workerSeenAt,updated_at")).json();
  if (!rows[0]) return {claim: true, heartbeat: false};
  const seen = rows[0].seen && Date.parse(rows[0].updated_at) > Date.parse(rows[0].seen) ? rows[0].updated_at : rows[0].seen;
  return workerClaimDecision(rows[0].jobs || [], seen || null, now);
}

export function workerClaimDecision(jobs: AppState["jobs"], seen: string | null, now: number) {
  const claim = !seen || jobs.some(job => job.status === "queued" ||
    (job.status === "running" && Date.parse(job.leaseUntil || "") < now));
  return {claim, heartbeat: !claim && now - Date.parse(seen) > 60000};
}

export async function touchWorkerSeenAt(now = new Date().toISOString()) {
  if (macserver()) {
    await macserverRequest({ action: "touchWorkerSeenAt", now });
    return;
  }
  if (!remote()) {
    db().prepare("UPDATE state SET worker_seen_at=? WHERE id=1").run(now);
    return;
  }
  await rest("afterimage_state?id=eq.1", {
    method: "PATCH",
    headers: {Prefer: "return=minimal"},
    body: JSON.stringify({updated_at: now}),
  });
}
export async function mutate<T>(fn: (state: AppState) => T): Promise<T> {
  for (let i = 0; i < 12; i++) {
    const { data, version } = await snapshot();
    const previous = JSON.stringify(data);
    const result = fn(data);
    if (JSON.stringify(data) === previous) return result;
    if (macserver()) {
      const {applied} = await macserverRequest<{applied: boolean}>({action: "compareAndSwap", version, data});
      if (applied) return result;
    } else if (remote()) {
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
  if (macserver()) return macserverRequest({ action: "assistantSnapshot" });
  if (!remote()) return (await snapshot()).data.assistantRequests || [];
  const rows = await (await rest("afterimage_state?id=eq.1&select=requests:data->assistantRequests")).json();
  return rows[0]?.requests || [];
}

/** Only the macserver bridge may apply a remote caller's optimistic update. */
export function compareAndSwapLocal(version: number, data: AppState): boolean {
  if (process.env.AFTERIMAGE_STORAGE !== "sqlite") throw new Error("SQLite storage is not active.");
  const result = db().prepare("UPDATE state SET data=?,version=? WHERE id=1 AND version=?")
    .run(JSON.stringify(data), version + 1, version);
  return Number(result.changes) === 1;
}
