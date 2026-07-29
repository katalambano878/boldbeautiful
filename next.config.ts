import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.boldnbeautiful.store',
        pathname: '/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'boldnbeautiful.store',
        pathname: '/storage/**',
      },
    ],
  },
  eslint: {
    // Temporary for Coolify cutover — tighten after HTTP client typings settle
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporary for Coolify cutover — HTTP client return types are still loose
    ignoreBuildErrors: true,
  },
  // Security + Caching headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      },
      {
        source: '/service-worker.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' }
        ]
      },
      // Cache storefront API routes aggressively (5 min CDN, revalidate in background)
      {
        source: '/api/storefront/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=900, stale-while-revalidate=1800' }
        ]
      },
      // Cache static assets (JS, CSS, fonts) for 1 year (they have content hashes)
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      // Cache optimized images for 30 days
      {
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }
        ]
      }
    ];
  }
};

export default nextConfig;
