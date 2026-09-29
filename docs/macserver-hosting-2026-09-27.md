# Macserver hosting migration

This records the earlier full-hosting proposal. The owner subsequently chose to keep Vercel serving the public site and use macserver for SQLite and workers. See `docs/macserver-hybrid-hosting.md` for the active plan. No full-hosting cutover occurred.

Status on September 27, 2026: **staged, not cut over**. Vercel still serves `afterimage.aarushagarwal.dev`; the existing macserver generation and assistant LaunchAgents still use `~/Projects/AfterImage` and the Vercel API. No production credential or library database has been transferred to the new host directory.

## Verified preparation

- The Supabase database row remains at version 10,207. A private September 25 export and local SQLite import both contain 14 papers and 26 jobs. The import is under ignored `.data/migration/`, with mode 0600. Recheck the live version immediately before any final transfer; do not overwrite a newer state.
- A separate source checkout is at `/Users/agarwalaarush/Projects/AfterImage-hosted` on macserver. The old worker checkout and LaunchAgents are untouched.
- macserver's Node 22.23.1 passes the current 56 tests, TypeScript check, and Next.js 16.3.5 production build. A localhost-only server on port 3100 passed `/`, `/login`, authorized `/api/state`, unchanged-version 204, and anonymous 401 checks with disposable data and test credentials. That smoke server was stopped afterward.
- `scripts/backup-sqlite.mjs` produced a consistent SQLite snapshot from the disposable database. A restored copy passed `PRAGMA integrity_check` and retained its state version. This verifies the backup mechanism, not an off-machine backup of future production writes.

## Storage and service boundaries

Set `AFTERIMAGE_STORAGE=sqlite` and `AFTERIMAGE_SQLITE_PATH` to an existing absolute, private database file when the web process runs on macserver. Production refuses to create a missing database. `scripts/import-supabase-state.ts` imports the one-row private export into a new SQLite file without overwriting an existing destination. The web process reads and writes that file; the workers continue to call the web API over localhost after their configuration changes. The browser receives no database or worker credential.

`scripts/web-launchd.plist` runs the production build on `127.0.0.1:3000` from the hosted directory. It does not expose port 3000 directly to the network. Logs go under ignored `.data/logs/`. The plist is prepared but not installed or loaded.

## Cutover sequence

1. Compare the live Supabase version with the private export again. Stop the old workers before switching their API target, then import that exact version into the private macserver database. Verify paper/job counts and `PRAGMA integrity_check` there.
2. Place only the required owner access key and worker token in a mode-0600 hosted `.env`; set SQLite mode and path, the localhost worker API URL, and Codex binary path. Do not copy Supabase service credentials or Vercel tokens into the hosted runtime.
3. Start the localhost web LaunchAgent. Check authenticated and anonymous state routes, login, paper rendering, state mutation, worker claim and completion, and an actual assistant stream. Restart both workers against localhost only after the compatible web renderer is active.
4. Create and verify a production SQLite backup, a restore, and an off-machine copy. Choose and configure recurring off-machine delivery before treating macserver as the only source of truth.
5. Establish HTTPS for the public domain and verify the **actual** `afterimage.aarushagarwal.dev` route and API after DNS propagation. Only then remove its Vercel assignment. Retain the Supabase export and old deployment for rollback until the new path has been exercised.

## Public route decision

The domain currently uses Vercel nameservers. [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) cannot serve this custom domain; it only serves the tailnet's `ts.net` names. [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/) can publish a custom hostname, but using it on a free Cloudflare zone requires moving the domain's authoritative DNS to Cloudflare. Cloudflare's [partial CNAME zone](https://developers.cloudflare.com/dns/zone-setups/partial-setup/) option, which leaves Vercel DNS authoritative, requires Business or Enterprise. A DNS move must preserve every existing website, mail, and verification record. Do not change nameservers from an incomplete zone inventory.

## Pending authorization

Automatic approval review rejected transmitting the owner and worker credentials over SSH to macserver because the port request did not specifically authorize that secret transfer. The production library export was also not transferred. The isolated checkout, disposable smoke data, and current Vercel route remain in place. The later hybrid choice supersedes the public-domain routing decision in this record; see `docs/macserver-hybrid-hosting.md` for its remaining transfer and backup requirements.
