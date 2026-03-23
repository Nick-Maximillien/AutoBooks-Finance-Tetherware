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
  
  // ---> NEW: Tell Next.js NOT to bundle native C++ modules <---
  serverExternalPackages: [
    '@tetherto/wdk-wallet-evm-erc-4337', 
    'sodium-native', 
    'libsodium-wrappers'
  ],

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
  
  // ---> UPDATED: Added { isServer } to arguments and injected externals <---
  webpack: (config, { isServer }) => {
    config.resolve.extensions.push('.json'); // 👈 Enables JSON imports (Your existing config)
    
    // Force Webpack to ignore the native binaries during server build
    if (isServer) {
      config.externals.push(
        'sodium-native', 
        '@tetherto/wdk-wallet-evm-erc-4337'
      );
    }
    
    return config;
  },
};

module.exports = nextConfig;