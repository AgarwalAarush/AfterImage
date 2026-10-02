import type { NextConfig } from "next";
const config: NextConfig = {
  distDir:process.env.AFTERIMAGE_BUILD_DIR||".next",
  serverExternalPackages: ["@resvg/resvg-js"],
  poweredByHeader: false,
  // Approval-time artifact readers must never pull private review/storage files
  // into a runtime bundle, even for a locally prebuilt deployment.
  outputFileTracingExcludes: {
    "/*": ["./.artifacts/**/*", "./.data/**/*", "./.assistant-runtime/**/*", "./.env*"],
  },
  outputFileTracingIncludes: {
    "/api/reader/assets/*": ["./node_modules/pdfjs-dist/cmaps/*", "./node_modules/pdfjs-dist/standard_fonts/*", "./node_modules/pdfjs-dist/wasm/*"],
    "/api/assistant": ["./src/content/subjects/lessons/*.json"],
    "/api/reader/pdf": ["./src/content/subjects/lessons/*.json"],
    "/subjects": ["./src/content/subjects/lessons/*.json"],
    "/subjects/*": ["./src/content/subjects/lessons/*.json", "./src/content/subjects/mechanisms/*.json",
      "./src/lib/subject-mechanism.ts", "./src/components/subject-mechanism.tsx",
      "./src/components/subject-mechanism.module.css", "./src/lib/scene-layout.ts",
      "./src/lib/diagram-text-metrics.ts", "./src/lib/diagram-text-metrics.json",
      "./src/app/globals.css", "./src/app/theme.css", "./src/app/ui.css", "./src/app/layout.tsx",
      "./src/components/paper-assistant.tsx", "./src/components/paper-pdf.tsx", "./src/components/assistant-answer.tsx",
      "./src/lib/assistant-model.ts", "./src/lib/pdf-location.ts",
      "./src/lib/theme.ts", "./src/components/subject-reader.tsx", "./src/components/subject-prose.tsx",
      "./src/lib/subject-visual-review-schema.ts", "./src/lib/subject-visual-review.ts",
      "./src/lib/subject-mechanism-quality.ts", "./src/lib/subject-mechanism-store.ts",
      "./package-lock.json", "./public/fonts/**/*",
      "./node_modules/@fontsource-variable/newsreader/**/*.css", "./node_modules/@fontsource-variable/newsreader/**/*.woff2",
      "./node_modules/@fontsource-variable/newsreader/**/*.woff",
      "./node_modules/@fontsource/ibm-plex-mono/**/*.css", "./node_modules/@fontsource/ibm-plex-mono/**/*.woff2",
      "./node_modules/@fontsource/ibm-plex-mono/**/*.woff"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/api/documents/:id",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};
export default config;
