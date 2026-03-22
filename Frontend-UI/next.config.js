/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 1. Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // 2. Disable ESLint checking during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**", // Allow all Cloudinary image paths
      },
    ],
  },
  webpack: (config) => {
    config.resolve.extensions.push('.json'); // 👈 Enables JSON imports
    return config;
  },
};

module.exports = nextConfig;