import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  // Disable React strict mode temporarily to help debug
  reactStrictMode: false,
  // Disable ESLint during builds for now
  eslint: {
    ignoreDuringBuilds: true
  },
  // Disable TypeScript checking during builds
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.dbl.id"
      },
      {
        protocol: "https",
        hostname: "spmbjatim.net"
      }
    ]
  }
}

export default nextConfig
