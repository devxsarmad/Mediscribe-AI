import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Render/CI builds should not fail on lint warnings during deploy.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
