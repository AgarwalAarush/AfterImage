# Current operations

Updated October 6, 2026. Start here before older hosting and outage records.

## Web source and release identity

The October 6 investigation found the production alias on CLI deployment `dpl_9Qu9oNH5zLjb8dMZ7LzieSiWuktZ`, uploaded October 3 before PR #14 merged. Its source is the PR #13 baseline plus five uncommitted Library renderer files; Vercel's project Git integration is absent. Merging to `main` therefore does not deploy this project automatically. The [source reconciliation](production-source-reconciliation-2026-10-06.md) retains those exact runtime bytes on the current recommendation source. The [owner-authorized renderer binding](subjects-renderer-binding-2026-10-06.md) preserves exact Subjects helper/routing equivalence and integration-binds Library rendering. The owner subsequently instructed deployment without the pending Dia workspace check; the [exact-source owner exception](owner-workspace-release-2026-10-06.md) records that authorization while preserving the normal scientific and diagram publication gates. Recheck the alias and source identity when releasing; this paragraph records the October 6 observation.

## Production and administration use different connections

| Purpose | Current route | Tailscale required? |
| --- | --- | --- |
| Website and authenticated APIs | Browser → Vercel | No |
| Authoritative storage | Vercel → Cloudflare Access → Cloudflare Tunnel on macserver → `127.0.0.1:3102` signed bridge → SQLite | No |
| Worker requests | Macserver workers → authenticated Vercel worker APIs → the storage route above | No |
| Operator SSH from this Mac | The current `macserver` SSH alias resolves to a private `*.ts.net` address | Yes for this configured route; an established LAN or console route can be used instead |

The Cloudflare cutover migrated **public storage ingress**. It did not replace private SSH with Cloudflare SSH. Stopping Tailscale on the operator's Mac can prevent deployment administration while the production site continues working. Reconnecting it is only necessary when using that SSH route. It does not resolve the separate administrator authentication required to update root-owned bridge code.

The October 2 check read Vercel's production origin and confirmed an HTTPS custom hostname rather than a `ts.net` origin, with both Access variables configured. An unsigned request received HTTP 403 from Cloudflare. This verifies the selected transport and Access gate, not a full authenticated SQLite read or host health check. The referenced “Diagnose recurring screen” task records the completed cutover, authenticated reader/worker checks, and retirement of AfterImage's Funnel mapping.

## Diagnose the connection that failed

1. For a website storage failure, inspect the current Vercel deployment and storage configuration. Preserve `AFTERIMAGE_STORAGE=macserver`, the configured Cloudflare origin, both server-only `AFTERIMAGE_CF_ACCESS_*` values, and bridge signatures. Inspect only sanitized transport diagnostics. Do not print or download credentials.
2. Cloudflare returns 403 without Access credentials. An authorized Access request without a valid bridge signature should reach the bridge's 401 gate. Neither rejection establishes an authenticated storage read. Verify Library/Documents, version polling, and worker APIs on the current deployment; hard-refresh the authenticated browser when validating a release.
3. For SSH failure, first inspect `ssh -G macserver` (hostname, user, port). Check the local Tailscale connection only if that route uses a tailnet address. A stopped client or “No route to host” is an administration-path problem, not evidence that Cloudflare is down. Do not change networking automatically; use the owner's chosen private route or console.
4. The storage bridge runs under `_afterimage` from root-owned code. The worker account intentionally cannot access its private database, backups, or signing key. Use administrator authentication for bridge installation; do not loosen permissions or expose the bridge to get around an SSH or sudo failure.

See [Cloudflare ingress](cloudflare-storage-ingress-2026-10-01.md) for service isolation, signed transport, cutover evidence, and rollback boundaries. See [assistant release](assistant-conversations-2026-10-02.md) for bridge → web/API → idle assistant-worker ordering and backup/restore checks.

## Legacy inventory and cleanup boundaries

- The application, assistant worker, and storage client contain no Tailscale-specific transport dependency. `macserver-client.ts` sends signed HTTPS requests and the production Cloudflare Access headers. Its generic transport support is still needed for localhost bridge tests; do not remove it.
- AfterImage's Funnel port 8443 mapping was retired. The old CLI retained an unused `AllowFunnel` permission; that is not an active AfterImage listener. Do not restore the mapping.
- `scripts/check-storage-relay.mjs` and `scripts/probe-storage-security.py` remain as historical diagnostics. Both now require `--legacy-funnel` explicitly; the relay checker no longer defaults to the current production origin. Their 401 expectation is inappropriate for Cloudflare's outer Access gate. Neither script is an application dependency, build step, or scheduled health check in this repository.
- Older hosting and outage documents preserve the original evidence, but are marked superseded for ingress operations. `.env.example` now shows a custom storage hostname, the isolated SQLite location, and explicit port 3102.
- Tailscale itself, the private SSH alias, and unrelated Funnel port 443 were outside the AfterImage migration. Do not uninstall Tailscale, delete the SSH alias, reset shared Funnel configuration, or remove another application's route as AfterImage cleanup. A host-level removal would require checking those remaining uses first.

The current release does not need a Tailscale runtime code removal or restart to serve traffic. Root-owned bridge updates require administrator authentication independently of transport. October 2 read-only inspection confirmed the conversation-capable bridge and protocol-2 assistant worker are installed; earlier pending conversation-release notes are historical. The [idle wake optimization](assistant-idle-wake-2026-10-02.md) was installed bridge-first on October 2, using a dedicated authenticated loopback listener on port 3104. Cloudflare metrics retain port 3103. See its release record for live verification and rollback. Post-cutover macserver-only backup restore verification passed, including conversation and turn tables.
