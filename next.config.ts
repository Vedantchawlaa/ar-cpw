import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (vendor bill reading) loads pdf.js's worker file at runtime;
  // bundling breaks that path, so load these straight from node_modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
