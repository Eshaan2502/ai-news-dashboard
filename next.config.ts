import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a lean Docker/Railway image.
  output: "standalone",
  // News thumbnails come from arbitrary source domains; we render them with a
  // plain <img>, so next/image remote config is intentionally omitted.
};

export default nextConfig;
