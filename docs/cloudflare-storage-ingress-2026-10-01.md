# Cloudflare storage ingress — October 1, 2026

Status: **live and verified** on October 1, 2026 (Pacific). The owner authorized
replacing the recurring failing Funnel public path with Cloudflare Tunnel after
accepting Cloudflare's HTTPS termination and visibility into AfterImage traffic.

For the concise current runbook and the distinction between production transport and private SSH, see [current operations](current-operations.md).

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
returns HTTP 403 without Access credentials. The isolated connector is installed
and Cloudflare reports Healthy with four connections. Vercel production uses the
Cloudflare storage origin and paired sensitive Access variables. Preparation
credentials are excluded from source, deployment uploads and browser bundles.

The connector recovery completed after an independent agent audit. The owner
authorized non-destructive administrator operations after that review.
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
occurred in that attempt. The next attempt copied the reviewed binary and private
token, then stopped because `/usr/bin/test` does not exist on this Mac. The
isolation check now uses the verified `/bin/test` path; the previous failure did
not demonstrate credential access. An explicit administrator-only
`--resume-files` mode verifies exact directory contents, ownership, modes, binary
SHA256 and the same restricted account before completing that known partial
installation. It refuses an existing plist and never recopies or exposes the
installed credential. The bridge remains unchanged. Readiness/metrics bind only to
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

## Verified production cutover

The production custom domain serves Ready deployment
`dpl_9MEbxmJauTsuhh2Ui68YowFYQMt2`, source
`e36557d2a9c41dd3475cb0235b80e937585a4fbe`. This combines the Cloudflare
client/connector changes with the independently reviewed Subjects typography
release. A concurrent typography-only deployment briefly omitted the Access
headers and received upstream 403s. Restoring the compatible deployment recovered
storage; the coordinated combined release preserves both changes. Every future
production deployment must include the Access-capable storage client while these
production environment values are active.

All **223 tests**, typecheck and the webpack production build pass. Publication
checks preserve 100 lessons, 203 figures and fourteen approved mechanisms.
All 23 fresh server traces exclude private artifacts, SQLite data, assistant
runtime and environment files. Access environment names are absent from browser
JavaScript. Private evidence remains in ignored `.artifacts/cloudflare-ingress/`.

External verification passes: missing Access credentials 403, valid Access
without HMAC 401, unmatched path 404, signed reads 200 and replay rejection 401.
The initial signed authoritative read reported 15 total paper records, five
documents, version 10368 and a worker heartbeat 44 seconds old. Nine prior local
snapshots existed, the latest 19.1 hours old. A fresh snapshot restored with
integrity `ok` and the documents table intact; the disposable restore and its
transient credential were removed. Backups remain only on macserver, so machine
loss could destroy the database and its backups.

Live owner desktop checks, including explicit Command–Shift–R hard reloads of
the reader and Documents shelf after retiring Funnel, load seven saved Library
cards, the reviewed EAGLE-3
notecard and diagram, all five Documents entries and an existing document's
rendered content. Production logs show library reads 200, unchanged-version
polling 204, document reads 200 and both actual worker endpoints 200. No storage
transport failures appear for the combined deployment in the verification window.
No model generation was started for these checks. MegaBlocks' previous failed
reading-kit preparation remains a separate content issue.

A uniquely generated, non-sensitive disposable Markdown fixture passed one
signed save, exact-byte read and one delete through the Cloudflare bridge. A
successful final list confirmed its removal and all five original documents
remained. This tests the bridge document lifecycle; live desktop/API checks test
Vercel document reads. Uncertain writes are reconciled by reads, never replayed.

After these checks, only the AfterImage TLS-terminated TCP mapping on Funnel
port 8443 was disabled. A private pre-change snapshot was retained, and every
unrelated configuration field matched afterward, including Ares port 443.
This Tailscale CLI retains the unused `AllowFunnel` permission for 8443; there is
no forwarding handler on that port. No shared reset was performed. A bounded
external 8443 request times out, while Cloudflare remains Healthy with four
connections and both authentication gates still reject unauthorized requests.
The preserved 443 endpoint responds with its existing HTTP 404.

The isolated connector, bridge and worker boundaries are unchanged. SQLite
remains authoritative. Re-enabling an old transport for rollback requires
verification and an explicit port-specific change; never restore stale Supabase
state or deploy an Access-incompatible client against the Cloudflare origin.
