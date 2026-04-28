import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: '.next.nosync',
  serverExternalPackages: ['better-sqlite3', 'puppeteer'],
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
