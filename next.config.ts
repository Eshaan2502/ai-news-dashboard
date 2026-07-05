import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a lean Docker/Railway image.
  output: "standalone",
  // News thumbnails come from arbitrary source domains; we render them with a
  // plain <img>, so next/image remote config is intentionally omitted.
  // jsdom (article full-text extraction) must stay a runtime require — bundling
  // it breaks its dynamic module loading.
  serverExternalPackages: ["jsdom"],
};

export default nextConfig;
