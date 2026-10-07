# Browser tab icon

AfterImage previously served no favicon and emitted no icon links, so Dia displayed its empty favicon placeholder. Root `src/app` metadata images now publish the existing stacked-paper mark as an SVG, a 64-pixel PNG fallback, and a multi-size `favicon.ico` (16, 32 and 48 pixels). Next.js adds the icon links and versions their URLs automatically.

The icons use explicit colors and a light surface so they remain legible in either browser appearance without depending on page CSS. They are public and available before sign-in. This needs only a web release; shared reader sources, Subjects presentation/approval bytes, dependencies, workers and storage remain unchanged. Existing tabs may need one reload to discover the links.

Local validation in this worktree passes TypeScript and diff checks. The login page emits all three versioned icon links, each unauthenticated request returns HTTP 200 with the correct image MIME type and exact asset bytes, and Dia visibly displays the stacked-paper mark. The local server on port 3168 was stopped at the owner's request.

The owner subsequently authorized merging and deployment. Current production is committed `main` at `4def09a656f44f0e245c9314983446a262b5c308` (deployment `dpl_G3y8iDDsedBDuegbtYurBXaNggrz`), including the reconciled renderer source and existing source-bound owner exceptions. PR #15 is updated onto that version. The earlier isolated production snapshot is no longer the release candidate. Release uses committed main, the ordinary npm-ci/webpack build and publication checks, a fresh private-output trace audit, and current HTTP/Dia verification.
