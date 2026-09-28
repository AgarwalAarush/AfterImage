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
- Owner-uploaded documents are stored separately from `afterimage_state` in private local SQLite or the service-only Supabase `afterimage_documents` table. Apply the documents migration before deploying the Documents feature; never add uploaded bytes to the public library snapshot or worker queue.
