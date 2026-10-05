import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Uploads de anexos de OC (limite app = 12 MB + overhead multipart)
  experimental: {
    proxyClientMaxBodySize: "15mb",
  },
};

export default nextConfig;
