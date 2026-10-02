# Cloudflare storage ingress — October 1, 2026

Status: prepared locally; **production has not switched**. The owner authorized
replacing the recurring failing Funnel public path with Cloudflare Tunnel after
accepting Cloudflare's HTTPS termination and visibility into AfterImage traffic.

## Verified prerequisites and remaining access

At preparation time, `aarushagarwal.dev` uses `ns1.vercel-dns.com` and
`ns2.vercel-dns.com`. Vercel's complete records endpoint returned five records:
three apex CAA records for `pki.goog`, `sectigo.com`, and `letsencrypt.org`, an apex
ALIAS to `ce3d7291cb1bb41e.vercel-dns-017.com`, and a wildcard ALIAS to
`cname.vercel-dns-017.com`. DNSSEC is disabled. This inventory must be checked
again immediately before changing nameservers, alongside existing project domain
assignments and public DNS responses. Preserve the apex and wildcard Vercel
destinations using Cloudflare's supported DNS representation; keep existing
Vercel sites DNS-only. Do not rely on Cloudflare's automatic record scan alone.

The Cloudflare dashboard requires owner sign-in. `cloudflared` is not currently
installed on macserver, and noninteractive administrator access is unavailable.
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

The Cloudflare authentication regression, existing bridge integration and private
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
change. Build-generated edits to `next-env.d.ts` were restored. No deployment,
nameserver change, Cloudflare token or connector installation has occurred.
