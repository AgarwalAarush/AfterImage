# AfterImage security and diagram-system review

Reviewed September 12, 2026. This is a bounded source review and live authentication check, not a penetration test or certification of the entire Mac server. No security hardening changes were deployed during this review.

## Diagram system verified

- Shared SVG rendering controls fonts, connector routing, label spacing, native subscripts/superscripts, and separate desktop/mobile layouts (`src/lib/scene.ts`).
- Generation runs geometry/schema validation and actual-font text/connector/clipping checks, then renders desktop at 880px and mobile at 350px for a structured visual critique (`worker/diagram-review.ts`, `worker/index.ts`).
- The critic uses explicit defect categories, severity, location, evidence, and repair instructions. It checks mathematical order, dimensions, and scaling against supplied sources. These semantic checks remain model judgments, not mathematical proofs.
- There are up to four repair passes. A remaining must-fix prevents replacement with the failed result. Recall equations also undergo KaTeX and source-reference validation on the worker and completion API.
- All eight existing papers were refreshed to recall version 2. The live verification script currently reports ready status and no validator issues for all eight. LoRA uses a separately authored diagram and is excluded from the generated-scene geometric sweep; it has dedicated regression coverage and was visually reviewed in the preceding implementation pass.
- This improves future generations but is not an automatic learning/training system and cannot guarantee flawless diagrams.

## Live checks passed

Target: https://afterimage.aarushagarwal.dev

| Check | Result |
| --- | --- |
| Anonymous library read | 401 |
| Anonymous generate, recommend, and import requests | 401 each |
| Forged session signatures, including malformed expiry | 401 |
| Missing or invalid worker bearer token | 401 |
| Valid owner sign-in | 200 |
| Owner session with foreign-origin mutation | 403 |
| Session cookie attributes | HttpOnly, Secure, SameSite=Lax |
| Job IDs before/after authenticated probe | Unchanged |
| Worker TCP listening sockets | None found for running worker PID 88333 |
| Worker environment and Codex auth file permissions | Owner-only read/write (0600) |
| npm audit --omit=dev | Zero reported vulnerabilities |

The owner access key and worker token are distinct. Values were not printed. The worker polls outbound; AfterImage does not expose an HTTP service on the Mac server. Source imports are restricted to recognized paper identifiers/hosts. The checked-in database migration enables RLS and revokes anonymous/authenticated table access; live database policies were not independently queried in this review.

## Remaining security gaps

1. **Worker isolation is the highest priority.** Codex runs under the normal Mac-server account, with its real home directory, using `--sandbox read-only` and `--ignore-user-config`. The prompt says not to use tools, but the invocation does not explicitly remove tool capabilities or restrict readable files to the job inputs. Read-only is not a confidentiality boundary. A malicious source could attempt prompt injection to read accessible files and include them in output. This review did not demonstrate successful file disclosure or remote code execution.
2. **There is no hard Codex-usage budget.** The state API limits new jobs to 12/hour, but each job may make several model calls for drafting, critique, and repair. A stolen owner session/key could spend the user's Codex allowance within those controls. Recommended: durable worker-side daily/model-call limits and an emergency stop, accounting for retries and repairs.
3. **Login throttling is process-local.** The failed-attempt map is not shared across Vercel instances or retained across restarts. Recommended: durable shared throttling with a verified client-IP source.
4. **Sessions are long-lived and not individually revocable.** Cookies expire after 30 days; logout removes the browser cookie but does not invalidate a copied cookie. Recommended: revocable sessions and stronger owner authentication.
5. **Additional defense in depth remains.** There is no application CSP; malformed login JSON is not handled locally; development mode bypasses authentication and must remain bound to loopback. None of these observations established an anonymous production authentication bypass.

Priority: isolate generation from the user's home, credentials and other projects; explicitly disable unnecessary tools/connectors and enforce restricted read/network permissions; then strengthen usage limits, throttling and session revocation. Validate the actual runtime boundary using harmless canary files and adversarial inputs before claiming isolation.

Official reference: [OpenAI agent approvals and security](https://developers.openai.com/codex/agent-approvals-security), which documents that read-only mode can still read files and run commands inside the sandbox.

## Limits of this review

No full external port scan, host compromise investigation, independent database-policy verification, adversarial model execution, dependency source audit, or proof of absence of vulnerabilities was performed. Authentication probes and a clean advisory scan establish narrower facts only.
