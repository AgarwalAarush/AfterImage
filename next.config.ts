import type { NextConfig } from "next";
const config: NextConfig = {
  distDir:process.env.AFTERIMAGE_BUILD_DIR||".next",
  serverExternalPackages: ["@resvg/resvg-js"],
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/subjects": ["./src/content/subjects/lessons/*.json"],
    "/subjects/*": ["./src/content/subjects/lessons/*.json", "./src/content/subjects/mechanisms/*.json",
      "./src/lib/subject-mechanism.ts", "./src/components/subject-mechanism.tsx",
      "./src/components/subject-mechanism.module.css", "./src/lib/scene-layout.ts"],
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
