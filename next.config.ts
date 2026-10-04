import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Fotos oficiais dos candidatos vêm do CDN do TSE.
    remotePatterns: [{ protocol: "https", hostname: "resultados.tse.jus.br" }],
  },
};

export default nextConfig;
