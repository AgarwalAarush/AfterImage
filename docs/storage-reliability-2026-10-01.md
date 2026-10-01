# Storage connection diagnosis — October 1, 2026

Authenticated library and Documents reads returned HTTP 503 while macserver,
its isolated bridge, and Funnel were running. The prior scientific-diagram
deployment also failed before the dark-mode promotion. Fast failures do not
establish a timeout, credential rejection, or database fault on their own.

The Vercel storage client now records private structured failure diagnostics:
allowlisted action, request/response phase, upstream HTTP status if received,
elapsed milliseconds, bounded error class, and sanitized transport error codes.
It excludes bodies, library data, document bytes, URLs, credentials, signatures,
and raw exception messages. Browser errors stay generic. Allowlisted reads may
retry once after a connection reset, temporary DNS/connect failure, or upstream
HTTP 500/502/503/504, within a shared ten-second budget. A retried read uses a
fresh signature/nonce. Mutations, including worker presence updates, are never
retried. HTTP 409 for a duplicate document remains an expected conflict.

Deploy compatible diagnostics on Vercel before investigating the next failure.
Use the resulting status or transport code to guide recovery. Preserve the
authoritative SQLite database, service isolation, signed requests, and
macserver-only backups. Do not roll back to the pre-cutover Supabase state.

## Observed cause and recovery

Diagnostics deployment `dpl_EQY5RzZsDZSPGm67EQ7GJDrYsr7j` exposed `ECONNRESET`
before any upstream HTTP response, normally after about 140 ms. Both workers
and all storage reads shared this failure. Google and Cloudflare public DNS
returned two public Funnel relay IPs; forcing TLS requests to either reproduced
the connection reset. Ordinary requests from tailnet machines resolved through
MagicDNS to macserver's private Tailscale address and returned 401, masking the
public outage. Never use those private successes as public-path evidence.

Reapplying the route, cycling port 8443, and refreshing the network map did not
recover the public path. This CLI's port-specific off left `AllowFunnel` true.
Resetting the full verified two-endpoint configuration and immediately restoring
AfterImage's TLS-terminated TCP port 8443 to localhost 3102 and Ares HTTPS port
443 to localhost 10000 made `Hostinfo.IngressEnabled` transition false/true.
The daemon briefly reported an invalid packet filter and dropped ingress traffic
during convergence. The public path then recovered. This establishes a Funnel
ingress/packet-filter failure; it does not establish the original vendor trigger
or guarantee that resetting Funnel prevents future incidents.

Post-recovery authenticated checks returned library HTTP 200 with 14 papers at
SQLite version 10275, Documents HTTP 200, and unchanged-version HTTP 204. The
worker heartbeat advanced again and there were no active paper jobs. Both public
relays returned the expected 401 for unsigned probes. The database, credentials,
storage bridge process, and generation workers were not replaced or restarted.

Run `node scripts/check-storage-relay.mjs https://macserver.tail537cdd.ts.net:8443`
for a bounded, credential-free public-path check. It queries public DNS and pins
each public IPv4 relay while preserving hostname/certificate validation. Every
relay must return HTTP 401 for the unsigned storage request. It exits nonzero
on a failed relay; it neither modifies forwarding nor restarts anything. The
query discloses only the already-public hostname to Google's DNS resolver.
