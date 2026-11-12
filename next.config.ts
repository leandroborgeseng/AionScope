import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Uploads de anexos de OC (limite app = 12 MB + overhead multipart)
  experimental: {
    proxyClientMaxBodySize: "15mb",
  },
  async headers() {
    return [
      {
        source: "/convite/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
