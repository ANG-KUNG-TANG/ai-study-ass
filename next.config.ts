import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  serverExternalPackages: [
    "pdf-parse",
    "@napi-rs/canvas",
    "mammoth",
    "tau-prolog",
  ],

  outputFileTracingIncludes: {
    "/api/**/*": ["./src/server/intelligence/prolog/cs.rules.pl"],
  },
};

export default nextConfig;
