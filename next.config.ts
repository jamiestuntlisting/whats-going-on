import type { NextConfig } from "next";

// Local dev sits inside iCloud Drive; redirecting Next's build output to a
// `.nosync` suffixed directory keeps iCloud from syncing build artifacts.
// On Vercel (and any non-local CI) keep the default `.next` so Vercel's
// framework integration finds routes-manifest.json where it expects.
const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { distDir: '.next.nosync' }),
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
