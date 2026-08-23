import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    // Server-side only (SSR/API routes)
    BACKEND_URL: process.env.BACKEND_URL || "http://localhost:5000",
    // Client-side accessible (browser) — required for download URLs, video src, etc.
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:5000",
  },
};

export default nextConfig;
