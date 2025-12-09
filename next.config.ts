import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type checking during build (handled separately)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Standalone mode for Vercel deployment
  output: 'standalone',
};

export default nextConfig;
