# Browser tab icon

AfterImage previously served no favicon and emitted no icon links, so Dia displayed its empty favicon placeholder. The app now uses Next.js's root `src/app` metadata-image conventions to publish the existing stacked-paper mark as an SVG, a 64-pixel PNG fallback, and a multi-size `favicon.ico` (16, 32 and 48 pixels).

The icons use explicit colors and a light surface so they remain legible in either browser appearance without depending on page CSS. Next.js inserts the icon links and versions the SVG/PNG URLs. The assets are public, available before sign-in, and require only a web release. No shared reader source, Subjects presentation fingerprint, worker, storage or dependency bytes change. Existing tabs may need one reload to discover the new links.

TypeScript and diff checks pass; local HTML emits all three icon links and Dia visibly shows the mark. The ordinary build on current `main` finds an existing approval hold for 14 Subjects mechanisms, unrelated to these assets. The icon release therefore uses an exact SHA-1-verified snapshot of all 272 source files from current production deployment `dpl_9Qu9oNH5zLjb8dMZ7LzieSiWuktZ`, plus only the three icons. This retains its five newer renderer/study source files, rather than overwriting them with `main` or releasing pending recommendation changes.

The ordinary webpack production build of that snapshot passes the unchanged publication precheck (100 lessons, 203 figures, 14 mechanisms, zero issues), compilation and TypeScript. Fresh output traces contain no private review/storage/runtime/environment paths. No publication checks or fingerprints are bypassed. Live release checks follow promotion.
