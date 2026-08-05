import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "mammoth",
    "tau-prolog",
  ],

  // The Prolog rules are a runtime asset rather than a TypeScript import.
  // Explicit tracing prevents a serverless deployment from omitting it.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./src/server/intelligence/prolog/cs.rules.pl",
    ],
  },
};

export default nextConfig;
