# Browser tab icon

AfterImage previously served no favicon and emitted no icon links, so Dia displayed its empty favicon placeholder. The app now uses Next.js's root `src/app` metadata-image conventions to publish the existing stacked-paper mark as an SVG, a 64-pixel PNG fallback, and a multi-size `favicon.ico` (16, 32 and 48 pixels).

The icons use explicit colors and a light surface so they remain legible in either browser appearance without depending on page CSS. Next.js inserts the icon links and versions the SVG/PNG URLs. The assets are public, available before sign-in, and require only a web release. No shared reader source, Subjects presentation fingerprint, worker, storage or dependency bytes change. Existing tabs may need one reload to discover the new links.

Validation uses the ordinary webpack production build with the unchanged Subjects publication precheck, a fresh output-trace audit, HTTP checks for the emitted links and all icon responses, and Dia tab verification. Release results are recorded after deployment.
