# Storage connection diagnosis — October 1, 2026

Authenticated library and Documents reads returned HTTP 503 while macserver,
its isolated bridge, and Funnel were running. The prior scientific-diagram
deployment also failed before the dark-mode promotion. Fast failures do not
establish a timeout, credential rejection, or database fault on their own.

The Vercel storage client now records private structured failure diagnostics:
allowlisted action, request/response phase, upstream HTTP status if received,
elapsed milliseconds, bounded error class, and sanitized transport error codes.
It excludes bodies, library data, document bytes, URLs, credentials, signatures,
and raw exception messages. Browser errors stay generic; uncertain writes are
never retried. HTTP 409 for a duplicate document remains an expected conflict.

Deploy compatible diagnostics on Vercel before investigating the next failure.
Use the resulting status or transport code to guide recovery. Preserve the
authoritative SQLite database, service isolation, signed requests, and
macserver-only backups. Do not roll back to the pre-cutover Supabase state.

Release and recovery evidence will be recorded after live checks.
