# Assistant queue wake notifications

## Behavior and boundary

Questions are saved immediately through authenticated Vercel routes and signed bridge operations. Previously, the macserver assistant repeatedly called `/api/assistant/worker` every two seconds while idle. The new worker subscribes to the storage bridge's separate loopback-only notification listener and makes no repeated Vercel calls while idle and connected. Claims and all answer writes still use the existing Vercel worker API and protocol 2.

The listener binds only `127.0.0.1:3104`, at `GET /internal/assistant/events`. Cloudflare continues targeting only the storage listener on port 3102, which rejects this notification path. The notification listener has no storage actions and never returns question, answer, source, document, request ID or lease content. It authenticates a dedicated bearer credential, limits concurrent subscribers to two and closes slow readers. The worker still cannot read SQLite, backups, the storage signing credential or Cloudflare Access credentials.

The bridge registers a subscriber before reading durable readiness. A content-free `ready` event means queued work exists without a valid running lease; `wake` requests an active-worker cancellation check. Both use an empty JSON data object. Enqueues, cancellations and terminal writes notify only after a successful commit. Ordinary answer updates and lease heartbeats never emit notifications. Readiness checks do not expire or claim work. A one-shot timer rechecks an outstanding running lease at expiry, so a disconnected or crashed claimant cannot strand other queued turns. No timer polls an empty queue.

The worker drains work serially and then waits. Real cumulative text still updates at a 650 ms cadence when changed; unchanged-text heartbeats renew leases five seconds after the last successful contact and omit answer content. A cancellation signal checks immediately, including when a prior update is in flight. The stream sends local connection heartbeats every 15 seconds, with a 45-second stalled-stream watchdog and reconnection delays bounded to 1–30 seconds. While disconnected, normal recovery claims occur every 30 seconds. A lost claim response suspends recovery claims until a fresh durable readiness signal; uncertain updates, completion and failure writes are never replayed. A lost completion response cannot overwrite a completed answer with failure.

There is no schema migration, reader layout change, public assistant API change or additional model call. The regular paper worker and the reader's active-answer SSE polling remain separate from this idle-assistant optimization.

## Configuration

The bridge loads `AFTERIMAGE_ASSISTANT_WAKE_TOKEN` from a separate mode-0600 file inside its isolated private service directory. The optional `AFTERIMAGE_ASSISTANT_WAKE_PORT` defaults to 3104 and must differ from its storage port. A wake credential equal to the storage credential is rejected. Configuring a wake port without its credential fails closed; omitting both retains compatibility with the old bridge configuration.

The worker loads the same dedicated wake token from its mode-0600 `.env.assistant-wake`, kept outside source control and web output traces. Its optional `AFTERIMAGE_ASSISTANT_WAKE_URL` must be exactly a plain HTTP loopback URL with hostname `127.0.0.1` and path `/internal/assistant/events`; it defaults to port 3104. Redirects, query credentials and other hosts are rejected. No wake credentials belong in Vercel, browser state, the public tunnel connector or the Codex model subprocess. The existing worker `.env` and signing credentials are preserved.

## Rollout

Read-only inspection on October 2 found the live assistant in `/Users/agarwalaarush/Projects/AfterImage-assistant-20261002`, sending protocol-2 claims, and a root-owned isolated bridge with conversation operations. Earlier pending-release notes do not establish its current installation state. The configured SSH hostname failed to resolve on the operator Mac; the established private IP route reached macserver without changing networking. The owner supplied administrator authentication for the scoped installer. Port 3103 was already occupied by Cloudflare metrics, so notifications use the separately verified loopback port 3104.

Stage only these eight public source files, plus the installer, and generate `release.sha256` containing SHA-256 digests for the eight fixed paths: `scripts/storage-server.ts`, `scripts/assistant-wake-server.ts`, `src/lib/assistant-storage.ts`, `scripts/check-assistant-release.ts`, `worker/assistant.ts`, `worker/assistant-runtime.ts`, `worker/assistant-wake.ts`, and `package-lock.json`. Never stage environments, private data, backups, runtime files or review artifacts.

Run on macserver as administrator:

```sh
sudo bash "$STAGE/scripts/install-assistant-wake-macserver.sh" "$STAGE" --check
sudo bash "$STAGE/scripts/install-assistant-wake-macserver.sh" "$STAGE" --install
sudo bash "$STAGE/scripts/install-assistant-wake-macserver.sh" "$STAGE" --verify
```

The installer verifies the fixed manifest and pinned worker dependency closure (`tsx`, `zod` and their installed transitive dependencies), requires the existing conversation migration, rejects active legacy/conversation work, makes and restores a macserver-only backup, and retains previous source and LaunchAgent/Daemon plists. The existing minimal assistant release has no root lockfile; its dependency symlink and installed lock provide the preflight inventory. No dependency/font bytes or Subjects fingerprints are changed. It creates a separate worker release, reuses the prior dependency directory without changing it, and copies the existing worker environment locally without printing it. It creates paired, dedicated wake files, updates the bridge first and checks signed storage plus notification authentication before switching an idle worker. Launch services are re-bootstrapped so new arguments take effect, waiting for the old registration to disappear before accepting the replacement. The new worker-only copy is owned by the existing worker account and remains mode 0700; bridge code ownership and service isolation stay intact. Code/configuration rollback preserves post-release database writes. A failed installation retains wake files for inspection and refuses blind reapplication. The scoped `--recover-rollback` mode archives an unused credential locally only after proving source and plists match the retained rollback snapshot and no wake listener is active.

The new worker relies on the retained previous dependency directory; do not delete it. Rollback restores the prior bridge and worker plists/source, never an older database. Backups stay on macserver; loss of that machine can destroy both database and backups.

After activation, inspect five minutes of production logs: there should be no repeating idle assistant-worker calls. Check authenticated Library/Subjects assistant history, a disposable synthetic question, stop/cancel, reconnect and persisted completion using the established release workflow. Do not send private source material to a live model merely to measure idle traffic. CPU savings must be measured separately in authenticated Vercel usage; request reduction is not CPU attribution. A web deployment is unnecessary for activation: the new readiness method is used by the bridge, and the existing public worker protocol remains compatible.

## Verification and release status

Tests use disposable/in-memory SQLite and fake model output. They cover post-commit bridge notification, loopback authentication and listener isolation, serial/duplicate pickup, reconnect recovery, expired leases, cancellation, heartbeat renewal, final answer persistence and uncertain-response handling. Run the wall-clock idle acceptance separately:

```sh
AFTERIMAGE_WAKE_SOAK=1 node --import tsx --test tests/assistant-wake-soak.test.ts
```

Implementation and local verification do not establish production activation. The root-owned installation and subsequent production traffic/desktop checks are recorded separately below.

### Recorded October 2 result

The regression suite passed 244 tests, with only the separately invoked wall-clock soak skipped in the normal suite. The final soak passed: 300 idle seconds, zero worker API calls, one uninterrupted local connection, then synthetic queue pickup and completion in 13 ms. Type checking, shell syntax, production webpack build, the 100-lesson/203-figure/14-mechanism publication audit, and inspection of 25 fresh traces (zero private references) passed. No live model was called during local tests.

The public source manifest and installed worker dependency closure were verified in the stage below. Administrator installation activated bridge PID 16173 and the worker release `AfterImage-assistant-wake-20261002T222557Z`; worker PID 16313 has an established connection to `127.0.0.1:3104`. Signed storage and local stream authentication passed, as did the post-release backup restore. Missing/wrong credentials returned 401, and the storage listener rejected the wake path with 404. On macserver, repeatable preflight and verification use:

```sh
wake_stage=/Users/agarwalaarush/Projects/AfterImage-assistant-wake-stage-20261002-01a0fe88
sudo bash "$wake_stage/scripts/install-assistant-wake-macserver.sh" "$wake_stage" --check
sudo bash "$wake_stage/scripts/install-assistant-wake-macserver.sh" "$wake_stage" --install
sudo bash "$wake_stage/scripts/install-assistant-wake-macserver.sh" "$wake_stage" --verify
```

The production acceptance window from 22:30:49 through 22:35:49 UTC had zero `/api/assistant/worker` requests while PID 16313 retained the same established notification connection. Fifteen regular paper-worker calls confirmed independent traffic continued. Authenticated Subjects and a published FlashAttention lesson loaded in Dia. A synthetic release-verification question was committed at 22:36:16.515 UTC; the first assistant claim appeared in Vercel logs in that same second. Its 257-character answer completed at 22:36:22.898 UTC and persisted in authoritative SQLite. The reader displayed the cited answer after reload. Production request timestamps are second-resolution evidence, not a precise end-to-end latency benchmark; the disposable-data soak separately verified pickup and completion within 13 ms. Missing/wrong wake credentials returned 401, the storage and public website listeners rejected the notification path with 404, and a request through the private network interface could not reach port 3104. CPU savings remain unmeasured without authenticated Vercel usage data.
