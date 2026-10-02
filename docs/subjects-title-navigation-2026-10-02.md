# Subjects title navigation

Available lesson titles in the Subjects catalog now use a semantic Next.js link to the same route as “Read lesson”, with prefetch disabled. Titles retain their existing typography and inherit the shared keyboard focus style. Catalog entries without a published lesson keep their existing plain title and external Paper link.

This catalog-only change does not change lesson content, mechanism presentation fingerprints, stored library data, workers, or the storage bridge.

Validation: all 228 tests, typecheck, the Subjects publication audit (100 lessons, 203 figures, 14 mechanisms), and the webpack production build pass. In the desktop browser, clicking the Diffusion tutorial title and pressing Enter on it both open the matching reader; no console errors were observed. Browser evidence is local at `/private/tmp/afterimage-title-navigation.jpg`. This title-link change has not been deployed.

The October 2 branch check found remote `main` at `1850878`, Subjects at `c4aedb4`, and Cloudflare ingress at `76efc95`. Neither feature branch was an ancestor of remote `main`. Production was serving the combined CLI deployment `dpl_Cgzjq2eBDf5rA3CQoNn5LPL2ojhe`; anonymous Subjects redirected to login and anonymous state returned HTTP 401.
