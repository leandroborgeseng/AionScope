import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Next bloqueia assets de dev quando a origem não é localhost.
  // 127.0.0.1 é o host usado por agentes e pelo browser local.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
