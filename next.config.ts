import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep PDF parsing packages external in the server build.
  // The CLI sync path works when Node resolves these packages directly,
  // while Turbopack dev bundling can fail to emit the worker module.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
