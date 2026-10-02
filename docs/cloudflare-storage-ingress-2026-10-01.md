# Cloudflare storage ingress — October 1, 2026

Status: prepared locally; **production has not switched**. The owner authorized
replacing the recurring failing Funnel public path with Cloudflare Tunnel after
accepting Cloudflare's HTTPS termination and visibility into AfterImage traffic.

## Verified prerequisites and remaining access

Before activation, `aarushagarwal.dev` used `ns1.vercel-dns.com` and
`ns2.vercel-dns.com`. Vercel's complete records endpoint returned five records:
three apex CAA records for `pki.goog`, `sectigo.com`, and `letsencrypt.org`, an apex
ALIAS to `ce3d7291cb1bb41e.vercel-dns-017.com`, and a wildcard ALIAS to
`cname.vercel-dns-017.com`. DNSSEC is disabled. This inventory must be checked
again immediately before changing nameservers, alongside existing project domain
assignments and public DNS responses. That final inventory matched all five records. Preserve the apex and wildcard Vercel
destinations using Cloudflare's supported DNS representation; keep existing
Vercel sites DNS-only. Do not rely on Cloudflare's automatic record scan alone.

The owner has signed in and activated **Zero Trust Free**. Its checkout states
$0/month but requires a payment method and authorization for usage beyond free
limits; the owner accepted that condition. The free DNS zone contains the five
original records, with the Vercel destinations DNS-only. The registrar accepted
the switch to `lisa.ns.cloudflare.com` and `yichun.ns.cloudflare.com`; Cloudflare
reports the zone Active, and both independent public resolvers return that pair.
Checks after activation preserve successful
TLS and current HTTP statuses for the apex, www, AfterImage, Stratum, Ares and
Chemo (the existing Chemo 404 also remains a 404).

The named tunnel, exact-path localhost ingress, hostname cache bypass, dedicated
service token and Access application are created. The application has exactly
one Service Auth policy accepting only that token. The proxied storage hostname
returns HTTP 403 without Access credentials. The tunnel remains inactive pending
the restricted connector installation; no Vercel environment or deployment has
switched. Management credentials and service-token values remain in ignored,
mode-0600 preparation files.

`cloudflared` is not currently installed as a service on macserver, and
noninteractive administrator access is unavailable.
Do not store an administrator password in source, logs, chat, or a credentials
file. Authenticate interactively when installing the restricted service.

Cloudflare's free published-hostname setup requires a Cloudflare-managed domain;
partial CNAME setup with another authoritative DNS provider requires Business or
Enterprise. A Quick Tunnel with a random hostname is not the production target.
Sources: [setup](https://developers.cloudflare.com/tunnel/get-started/),
[partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/).

## Target and authentication

The public website and APIs stay on Vercel. A dedicated storage hostname routes
only to `http://127.0.0.1:3102` through a named Cloudflare Tunnel on macserver.
The authoritative SQLite file, bridge process, source validation and backups
remain in their existing isolated service. Tailscale remains available for
private SSH; unrelated public Funnel endpoints are outside this migration.

Protect the whole storage hostname with a Cloudflare Access application using a
**Service Auth** policy accepting only the dedicated Vercel service token. Do
not use a browser login policy or a bypass policy. Disable caching for the
hostname and exclude redirects, interactive challenges, and content-transforming
rules from this authenticated API path. Return a catch-all 404 for any other
tunnel ingress. Keep bridge signatures, nonce/replay checks, body bounds and
allowlisted actions unchanged. Access is an additional gate, never a replacement.

Vercel alone receives `AFTERIMAGE_CF_ACCESS_CLIENT_ID` and
`AFTERIMAGE_CF_ACCESS_CLIENT_SECRET`. The client sends Cloudflare's documented
`CF-Access-Client-Id` and `CF-Access-Client-Secret` headers alongside the existing
bridge signatures. The pair is optional for the existing route, but any partial,
empty, malformed, or insecure-origin configuration fails before sending data.
Neither token appears in browser state, logs or worker configuration. Redirects
remain errors, read retries remain bounded, and writes are never retried after an
uncertain response. See [service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

Install the connector from Cloudflare's official distribution as root-owned code
and supervise it with launchd under a restricted account. Keep tunnel credentials
in a service-only directory; never pass a long-lived token in process arguments
or expose the storage bridge secret to the connector. The connector needs local
TCP access, not SQLite or backup access.

`scripts/install-cloudflare-storage-macserver.sh` stages this boundary separately
from the storage bridge: `_afterimage_tunnel` (UID 498, no login) runs root-owned
code under `/Users/Shared/AfterImageTunnel`. Its token is stored in a mode-0700
directory, read with `--token-file`, and removed from the ordinary user's staging
directory after installation. The installer verifies that the connector cannot
read the SQLite database or storage credential, leaves the bridge untouched,
and refuses an existing filesystem installation. An explicit `--resume-account`
option permits only the exact UID, group, no-login shell, empty home and valid
identity of a pre-created staging account, with no authentication authority or
administrator/wheel membership. The first privileged attempt created that account
but macOS rejected rewriting its automatically assigned `GeneratedUID`; the
installer now preserves that identity. No connector files or bridge changes
occurred in that attempt. Readiness/metrics bind only to
`127.0.0.1:3103`. Connector output is discarded to avoid storing raw transport
URLs/errors; use readiness, connection counts and sanitized API checks for
verification. Automatic binary updates are disabled for this root-owned release.

The official `cloudflared` 2026.9.3 Intel macOS archive was checked against its
GitHub release asset SHA256 before extracting. The staged binary SHA256 is
`ab588b3b4db9cdb4476c30a3db2a72635b1d8327d44741fee6799a0f37b0ec07`.
Its version and `--token-file` support were verified on macserver. See
[run parameters](https://developers.cloudflare.com/tunnel/reference/run-parameters/).

## Cutover and proof

1. Prepare the Cloudflare free zone with the complete verified DNS inventory and
   check each existing site and mail/verification record before nameserver change.
2. Create the Access application/policy and named tunnel with bounded ingress,
   install its isolated connector, and confirm stable tunnel connections.
3. Verify the external hostname denies missing Access credentials, then denies a
   valid Access token without a bridge signature. Verify a correctly signed status
   request and document-list read succeed. Do not log credential values or bodies.
4. Deploy compatible Vercel client code with the new origin and paired Access
   credentials. Preserve the current live UI source. Validate before promotion.
5. Check the actual public site: owner session, library 200, Documents 200,
   unchanged-version 204, fresh worker heartbeat, generation and assistant queue
   polling. Do not start model generation merely as a transport test.
6. Upload/read/delete one explicitly disposable, non-sensitive Markdown document;
   ensure the final shelf matches its previous state. Reconcile uncertain writes
   through successful reads rather than replaying them.
7. Open the desktop paper reader and Documents shelf; inspect rendered content and
   logs across repeated checks. Only then retire AfterImage Funnel port 8443.

Rollback keeps SQLite authoritative. Restore the previous compatible Vercel
deployment/environment only if the old transport is verified usable; never
promote stale Supabase state. Keep the old forwarding definition until cutover
acceptance, and do not reset shared Funnel configuration as part of cleanup.

## Local checks

The migration commits have been rebased onto `be74949`, which adds release notes
to the `1850878` production source. Current Vercel inspection still identifies
`dpl_ARPmkGgeCoxKLyYSvvvQCn9oEMn3` as Ready with the public alias, matching that
release's recorded deployment. This preserves the newer systemic diagram and
publication gates rather than deploying the older `523d25b` source.

On the updated base, all **220 integrated tests**, typecheck and the webpack
production build pass. The publication audit retains 100 lessons, 203 figures
and fourteen approved mechanisms with zero findings. The build audit checks all
21 server traces: no private artifacts, SQLite data, assistant runtime or
environment files; the Subjects reader trace includes all 114 lesson/mechanism
files. Cloudflare Access environment names do not appear in browser JavaScript.
Private validation evidence stays in ignored `.artifacts/cloudflare-ingress/`.
These checks prove the prepared release; live Cloudflare cutover is still pending
administrator connector installation and the remaining live acceptance checks.

Initial preparation also verified the Cloudflare authentication regression, existing bridge integration and private
diagnostic tests all pass (three tests). TypeScript and `git diff --check` pass.
The integration test uses a disposable SQLite database and proves signed reads,
version preservation and document operations; it required localhost networking
outside the default sandbox. The new regression proves Access headers and bridge
signatures coexist, rejected Access credentials are not retried or logged, and
partial/malformed configuration cannot send library data. Live acceptance remains
unverified until the prerequisites above are complete.

The Next.js 16.3.5 production build also passes after copying the existing
dependencies into this worktree (Turbopack does not accept an out-of-root
`node_modules` symlink). The build reports two existing broad filesystem-tracing
warnings in `subject-mechanism-store.ts`; these are outside the storage client
change. Build-generated edits to `next-env.d.ts` were restored. The connector
installer passes shell syntax checks and a read-only macserver preflight using
a disposable placeholder token. No account or service was created by that check.
The owner-created management token is restricted to the owner's Cloudflare
account and this DNS zone. Resource configuration and nameserver activation are
complete; no Vercel deployment or connector service installation has occurred.
