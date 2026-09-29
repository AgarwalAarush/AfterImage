import { randomUUID } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, statSync, unlinkSync, chmodSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [source, destination] = process.argv.slice(2);
if (!source || !destination || !path.isAbsolute(destination)) {
  console.error("Usage: tsx scripts/import-supabase-state.ts <private-export.json> <absolute-destination.sqlite>");
  process.exit(2);
}
if (existsSync(destination)) throw new Error("Destination already exists; import will not overwrite a database.");

const exportFile = JSON.parse(readFileSync(source, "utf8"));
const rows = exportFile.rows;
if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Expected one exported state row.");
const { version, data } = rows[0];
if (!Number.isSafeInteger(version) || version < 0 || !data || typeof data !== "object" ||
  !Array.isArray(data.papers) || !Array.isArray(data.jobs) || !data.entries || typeof data.entries !== "object")
  throw new Error("Exported state is incomplete.");

process.umask(0o077);
const directory = path.dirname(destination);
mkdirSync(directory, { recursive: true, mode: 0o700 });
if ((statSync(directory).mode & 0o077) !== 0)
  throw new Error("Destination directory must be private (mode 0700).");

const temporary = path.join(directory, `.${path.basename(destination)}.import-${randomUUID()}`);
let database: DatabaseSync | undefined;
try {
  database = new DatabaseSync(temporary);
  database.exec("PRAGMA journal_mode=DELETE; CREATE TABLE state (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)");
  const json = JSON.stringify(data);
  database.prepare("INSERT INTO state (id,version,data) VALUES (1,?,?)").run(version, json);
  const check = database.prepare("SELECT version,data FROM state WHERE id=1").get() as {version: number; data: string};
  if (check.version !== version || check.data !== json) throw new Error("SQLite verification failed.");
  database.close();
  database = undefined;
  chmodSync(temporary, 0o600);
  linkSync(temporary, destination);
  console.log(JSON.stringify({version, papers: data.papers.length, jobs: data.jobs.length, bytes: statSync(destination).size}));
} finally {
  database?.close();
  if (existsSync(temporary)) unlinkSync(temporary);
}
