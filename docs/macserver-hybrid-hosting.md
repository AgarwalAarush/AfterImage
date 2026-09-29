# Vercel site with macserver storage

Status (September 28): **hybrid production cutover completed**. Deployment `dpl_8kasqLKqReMxmLyBM5FErcyTkGmg` (`afterimage-jqomn4na4-aarush-agarwals-projects.vercel.app`) now serves `afterimage.aarushagarwal.dev`. The live route returned the private 14-paper library from SQLite at version 10,208 after a verified save. Vercel holds the sensitive dedicated bridge credential and production backend selector/URL. Macserver runs both worker agents from `/Users/agarwalaarush/Projects/AfterImage-worker-20260928`. No Git commit or push was performed; the release includes the current workspace source.

The restricted `_afterimage` account holds SQLite, backups, export, and credential. Root owns service code. The regular worker account was denied reads of these private files. The owner specifically authorized public port 8443 and external tests; it now terminates TLS through Funnel and forwards TCP to the localhost-only bridge at port 3102.

## Boundary

```text
Browser -> Vercel Next.js pages and authenticated API routes
                  |
                  | HTTPS, per-request signed storage call
                  v
             Tailscale Funnel -> 127.0.0.1:3102 isolated storage bridge -> SQLite

macserver workers -> existing Vercel worker API routes
```

Vercel continues serving `afterimage.aarushagarwal.dev`, including sign-in, validation, and API responses. Browser requests never receive the bridge URL or service credential. `AFTERIMAGE_STORAGE=macserver` makes the server-side store client send only six allowlisted operations to macserver: snapshot, status, worker queue status, assistant queue snapshot, worker-presence update, and optimistic compare-and-swap. The bridge runs with `AFTERIMAGE_STORAGE=sqlite`, and the database never opens on Vercel. The owner access key remains on Vercel; the separate worker token remains with the workers and Vercel.

The bridge listens on `127.0.0.1` only. Every request carries an HMAC envelope signature over a timestamp and nonce plus a separate signature over the body, using a dedicated service credential. It rejects callers without the secret before reading their body, returns HTTP 429 after 30 rejected requests in a one-second window, rejects altered and replayed requests, limits body size and connection time, and exposes no general-purpose SQL or file API. A public HTTPS tunnel is still a network entry point; the application signature is required even when the tunnel is reachable. Keep the credential out of source control and rotate it independently of owner and worker credentials.

The SQLite state row retains optimistic version checks. A separate `worker_seen_at` column records idle presence without incrementing the JSON state version, keeping browser polling and storage traffic small. Opening an imported three-column database migrates that column in place. Production refuses a missing SQLite file. Use `scripts/backup-sqlite.mjs` and verify a restore before cutover. The owner selected macserver-only backups on September 28; these protect against database corruption but not loss of the machine or its storage.

## Verification and release order

1. Compare Supabase's live state version with the private export. The September 28 Management API query still returned version 10,207; the REST API returned quota HTTP 402. Recheck immediately before cutover, make a fresh export if changed, and stop the old workers for the final data snapshot so no job completion is lost.
2. Import the exact state into the private macserver SQLite file. The isolated service database and backup were checked for integrity and version 10,207, and a backup restore was tested. The restricted backup LaunchDaemon runs at load and daily at 03:15. The backup script tolerates a concurrent write while preserving a consistent SQLite snapshot. Monitor its private error log and disk space; snapshots currently have no automatic retention limit.
3. The isolated service has a fresh bridge credential, separate from the owner and worker tokens. It was streamed directly into Vercel's sensitive Production variable without writing or printing it on this Mac. The signed localhost bridge was verified on port 3102. The old bridge on port 3101 and its backup agent were stopped; their private data and service plists are archived under the service-only directory.
4. Use an HTTPS tunnel endpoint for the bridge, with a stable hostname. [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel) can use a `ts.net` address as the Vercel-to-macserver upstream without moving the public domain's DNS. Macserver already serves another application on Funnel port 443; use a separate allowed port, 8443, for AfterImage. Enabling Funnel makes its endpoint reachable from the internet; keep the HMAC gate active. Test unauthorized, altered, and replayed requests from outside macserver.
5. Deploy the Vercel code with `AFTERIMAGE_STORAGE=macserver`, `AFTERIMAGE_BACKEND_URL`, and the bridge credential. Validate the production API, login, library, mutation, paper rendering, worker claim/completion, and assistant streaming end to end. Then restart macserver workers on compatible code. Keep the prior Supabase export and release available for rollback until the new path is stable.

Vercel remains the public host and its DNS records stay in place. If macserver or the tunnel is unavailable, the site can load but library and generation requests will fail; the UI must show a recoverable connection error. The backend receives the full private state over HTTPS on mutations and first loads, so the tunnel needs reliable bandwidth. Idle polls use compact status calls.

The selected macserver-only backup location means failure or loss of that machine can destroy both the live database and its snapshots. The attempted copy to this Mac was rejected by automatic approval review before transfer because the destination had not been selected; no off-machine copy was made.

The September 12 review identified that worker Codex sessions run under the regular macOS account with a read-only sandbox and real home directory. That sandbox does not protect owner-readable secrets from a malicious paper. The September 28 isolation moved storage to `_afterimage` (UID 499): root owns code, the service owns its mode-0700 private directory, and the regular worker account cannot read the credential, database, backups, or archived original copies. HMAC still does not protect against compromise of the service account itself or Vercel's server-side credential.

September 28 follow-up: the existing Funnel port 443 proxies to `127.0.0.1:10000`, an Ares worker Node process under the regular macOS account. Its HTTP server accepts only `GET /dashboard` and `POST /rpc`; source requires a separate `ARES_WORKER_SHARED_SECRET` at startup and compares bearer tokens before accessing data or reading the RPC body. Anonymous requests to both routes returned 401 through Funnel and localhost. Earlier probes of unrelated paths returned 404 because this is the worker server, not the Ares Next.js app. This is a bounded route/auth check, not a full Ares security review. AfterImage port 8443 was subsequently enabled with the owner's authorization and tested as described below. The restricted account and system LaunchDaemons required the owner to provide local administrator authorization; the original user-owned bridge and private copies were then retired.

`scripts/prepare-isolated-storage-macserver.sh` was the one-time administrator setup. `--check` performs a nonmutating preflight. `--apply` is guarded to macserver and root, refuses an existing destination or a service account with unexpected attributes, creates or resumes the disabled-login `_afterimage` service user, copies code into a root-owned directory and a consistent SQLite snapshot plus backups and export into a service-owned private directory, mints a fresh bridge credential, and starts isolated bridge and backup LaunchDaemons on localhost port 3102. The original port-3101 bridge and files were retained until signed-request, read-denial, backup, and restore checks passed, then archived privately. Do not print the credential into logs or a shell transcript.

The first September 28 administrator run stopped while setting the optional `IsHidden` account field (`eDSPermissionError`). It left the expected UID-499 `_afterimage` account with `/usr/bin/false` shell and no authentication authority, but created no service directory or daemon. The setup script now verifies those exact fields and safely resumes from that partial state; it no longer requests the optional hidden flag. The system UID is below the normal macOS human-account range. Re-run `--check` before `--apply` and stop if it reports a different account or any destination already exists.

The earlier `scripts/web-launchd.plist` and full-hosting plan are retained as unused fallback artifacts; do not install that plist for the hybrid release.

## September 28 external tests and live evidence

- Edge (Jetson) and this Mac each passed 26 unsigned checks and eight signed checks. Both clients connected directly to public Funnel relay IPs (`208.111.35.209` and `208.111.34.11`) with certificate verification and hostname SNI. Edge shares the local network, so pinning the public relay avoids a LAN/tailnet shortcut; the independent Vercel deployment also exercised the backend from the cloud.
- Anonymous requests to all six actions returned 401; file/traversal/extra-path attempts returned 404; unsupported methods returned 405; invalid content type returned 415; oversized headers returned 431. Forged identity headers and HMAC signatures did not grant access.
- Short-lived request signatures were minted on macserver for fixed status/invalid requests. The long-term bridge secret was never sent to edge. Valid signed status returned 200; replay, altered body, expired signatures, and future timestamps returned 401; malformed JSON, unknown actions, and invalid compare-and-swap payloads returned 400.
- A bounded burst of 64 invalid requests over eight TLS connections returned 30 HTTP 401 and 34 HTTP 429 on edge. This verifies response throttling, not protection from volumetric attacks or total host exhaustion.
- An availability flaw was found in the initial HTTP Funnel path: incomplete request bodies stalled despite the bridge's early authentication rejection. Port 8443 was closed while investigating, then switched to TLS-terminated TCP forwarding. Both clients now receive 401 for unsigned/forged incomplete 8 MB uploads without sending the body (edge about 0.16 seconds). No application plaintext port is exposed.

Reapply the verified forwarding configuration on macserver:

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale funnel --bg --tls-terminated-tcp=8443 --yes tcp://127.0.0.1:3102
```

To withdraw only AfterImage's endpoint, use `funnel --tls-terminated-tcp=8443 off`; preserve the separate Ares endpoint on port 443. The CLI's [TLS-terminated TCP option](https://tailscale.com/docs/reference/tailscale-cli/funnel) avoids HTTP proxy buffering. Do not enable PROXY protocol: the bridge expects ordinary HTTP bytes after TLS termination.

`python3 scripts/probe-storage-security.py --relay <current-public-relay-IP>` runs the bounded unauthenticated checks. `--signed` reads ephemeral vectors from stdin; `--expected-version` optionally pins the read-only status assertion. Regenerate short-lived vectors on macserver for every run. The probe accepts no long-term credential. Reports in ignored `.artifacts/security/` contain status/count/version evidence, not library data or credentials.

The staged Vercel deployment passed login, secure-cookie checks, anonymous/forged-session rejection, CSRF rejection, disallowed import host rejection, worker-token separation, authenticated library reads, and unchanged polling. A no-op mutation correctly skipped writing. Saving the existing direction values (only its update timestamp changed) advanced SQLite from 10,207 to 10,208 and the next poll returned 204. Supabase's Management API still showed 10,207 and zero active generation jobs before the old workers were stopped. Production was promoted only after these checks.

After promotion, direct public-domain checks passed anonymous 401, owner login, the 14-paper SQLite read, fresh worker presence, assistant history reads, and SSE fault transport for an absent request. The browser rendered the library and EAGLE-3 paper/diagram. Both worker LaunchAgents report running with the new release. Typechecking and all 57 automated tests passed; Vercel's build also passed.

A real generated assistant response is **not yet verified** in this release. Automatic approval review blocked the proposed test because it would send paper excerpts, generated notes, and conversation context to the existing Codex/ChatGPT assistant service. A specific approval request is pending. No test question was enqueued. Fresh generation/assistant model completion therefore remains an explicit verification gap, despite successful storage, worker-auth, and stream-transport checks.

## Operational limits and rollback

These bounded checks are not a full penetration test or host audit. They do not guarantee safety against an unknown exploit, leaked Vercel/service credentials, a privileged host compromise, or sustained resource exhaustion. A stolen bridge credential grants library read/write operations. The service account boundary limits access to worker-owned private files but is not a VM; review other world-readable host files separately. The worker's existing read-only Codex sandbox still does not protect other files readable by its macOS user.

The owner-provided administrator password appeared in chat and should be rotated by the owner; rotation was not performed. Backups remain exclusively on macserver, so machine/storage loss can destroy both the database and snapshots.

Old worker code remains at `/Users/agarwalaarush/Projects/AfterImage`; saved pre-hybrid service definitions are in its private `.artifacts/pre-hybrid-services/`. The previous Vercel deployment remains available, but its Supabase backend is now stale. Prefer reverting compatible application code while retaining macserver storage; reconcile all SQLite writes before any storage rollback. Never blindly promote the old Supabase-backed deployment.

Deployment upload review confirmed that environment files, private data, logs, scripts, tests, and worker code were excluded. Supabase CLI metadata and TypeScript incremental build metadata are now also explicitly excluded from future Vercel uploads. The initial hybrid build included that CLI metadata; it was not served as a static route, and the pooler URL contained no password.

A fresh post-cutover backup at version 10,208 was created in the service-only backups directory and restored to a disposable file on macserver. `PRAGMA integrity_check` returned `ok`; the restore matched version 10,208, the worker account could not read the database or credential, and the recurring backup LaunchDaemon reported last exit code 0.
