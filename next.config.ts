import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Uploads de anexos de OC (limite app = 12 MB + overhead multipart)
  experimental: {
    proxyClientMaxBodySize: "15mb",
  },
  // A tela Processos saiu da Sala (D-SD4 / X2): links antigos vão para a Sala com HTTP 307.
  async redirects() {
    return [{ source: "/sala/processos", destination: "/sala", permanent: false }];
  },
};

export default nextConfig;
