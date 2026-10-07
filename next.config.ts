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
      "./src/content/subjects/workspace-acceptance.json", "./src/content/subjects/workspace-owner-exception.json", "./src/content/subjects/catalog.json",
      "./src/content/subjects/text-width-owner-exception.json",
      // Runtime scope and isolation checks read source bytes, including the
      // feature import closure. These globs contain code only; private artifacts,
      // credentials and storage remain excluded above.
      "./src/components/**/*.{ts,tsx,css}", "./src/lib/**/*.{ts,json}",
      "./src/app/**/*.{ts,tsx,js,jsx,mdx,css}",
      "./next.config.ts", "./package-lock.json", "./public/fonts/**/*",
      "./node_modules/@fontsource-variable/newsreader/**/*.{css,woff,woff2}",
      "./node_modules/@fontsource/ibm-plex-mono/**/*.{css,woff,woff2}"],
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
      // Same-origin iframes are permitted only for the local development review.
      // Production retains DENY and both review routes return 404.
      ...(process.env.NODE_ENV === "development" ? [{
        source: "/subjects/review/workspace/frame",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      }] : []),
      {
        source: "/api/documents/:id",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};
export default config;
