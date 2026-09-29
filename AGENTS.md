<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AfterImage workspace rules

- Keep `.next`, `.next-production`, `.vercel`, `node_modules`, `.data`, `.artifacts`, `.assistant-runtime`, and generated build artifacts untracked. The existing `.gitignore` is the source of truth for ignored artifacts.
- Preserve `.env*` and all secrets. Keep only `.env.example` in source control.
- When changing behavior in app, worker, or scripts, include a matching note in `docs/` and a short context update in `README.md`.
- Update `AGENTS.md` whenever architecture boundaries, data handling assumptions, or release constraints change.
- Prefer small, topic-scoped commits with explicit intent. Default commit format: `feat:`, `fix:`, `docs:`, `chore:`.
- Before creating a remote or pushing, verify credentials, remote URL, and branch target in the current thread (do not assume GitHub default naming).
- If a request references deployment status, verify it from Vercel and API checks at the time of the request, not from stale historical notes.
- `Paper.generationStep` is a reader-facing, worker-reported milestone only; keep raw generation and review errors in private job diagnostics rather than rendering them in the paper UI.
- New generated diagrams store `layout: "flow-v2"`. The model supplies semantic nodes and edges; `scene-layout.ts` owns coordinates, text bounds, and arrow routing. Legacy scenes retain their original renderer. Deploy the web validator/renderer before enabling the updated worker: an older API strips the layout version and rejects the compatibility coordinates. Keep generation, source, and visual review gates enabled.
- Keep background polling on small version or queue projections. The remote worker presence heartbeat updates `afterimage_state.updated_at` independently of the JSON state version; the browser derives `workerSeenAt` from that timestamp. Full-state reads remain for first load, changed versions, and actual mutations.
- The selected hybrid target keeps the public Next.js site, user authentication, and API routes on Vercel. Macserver owns SQLite and worker execution behind a localhost-only, signed storage bridge. Vercel selects `AFTERIMAGE_STORAGE=macserver`; the macserver bridge selects `sqlite`. Use a dedicated bridge secret, never the owner key or worker token. Do not expose the SQLite file or a broad macserver web API through the public tunnel. The previous full-hosting plist remains an unused fallback.
- The September 28 hybrid release is live: Vercel uses macserver storage, and both macserver workers run the compatible release. SQLite is now authoritative. Preserve the previous Supabase export and releases, but never roll production back to the stale Supabase state without reconciling post-cutover writes. Production SQLite requires an existing absolute `AFTERIMAGE_SQLITE_PATH`; never let a missing database silently initialize a new library.
- The owner selected backups retained on macserver only. Verify recurring local snapshots and a restore before cutover, and state plainly that machine loss could destroy both the database and those backups. Do not copy private backups to another machine without a new destination-specific authorization.
- The storage bridge now runs as the restricted `_afterimage` account from root-owned code, with its SQLite library, backups, export, and credential in a mode-0700 service directory. The existing worker account is denied access; old user-owned private copies and LaunchAgents were moved into that service directory for rollback. The owner authorized public Funnel port 8443 and external security tests on September 28. Keep the bridge bound to localhost; use TLS-terminated TCP forwarding to port 3102, since the HTTP reverse proxy stalled incomplete uploads before returning early rejections. Preserve envelope/body signatures, replay checks, and bounds; returning HTTP 429 is not volumetric denial-of-service protection. A read-only Codex sandbox is not a confidentiality boundary for owner-readable files.
- Owner-uploaded documents belong in a separate table in the authoritative macserver SQLite database, outside `afterimage_state`; Vercel accesses them only through allowlisted signed bridge actions. Keep document bytes out of public library snapshots and worker queues. Deploy the compatible bridge before enabling document routes on Vercel, and verify backups include the table.
