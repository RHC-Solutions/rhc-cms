import { SECURITY_HEADERS } from './security-headers.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: Static export is DISABLED to enable CMS API routes
  // For production with CMS, deploy to a server environment (Vercel, Railway, etc.)
  
  // Use Turbopack (default in Next.js 16)
  turbopack: {},
  
  images: {
    unoptimized: false, // Enable Next.js image optimization
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    // Allowlist remote image hosts. Wildcard hostnames are intentionally avoided
    // to mitigate the next/image SSRF / DoS class of vulnerabilities
    // (see GHSA-9g9p-9gw9-jx7f). Add explicit hosts here when needed.
    remotePatterns: [
      { protocol: 'https', hostname: 'rhcsolutions.com' },
      { protocol: 'https', hostname: 'www.rhcsolutions.com' },
    ],
  },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Optimize bundle size
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react', 'react-icons', '@react-icons/all-files'],
    webpackBuildWorker: true,
    // Note: experimental.optimizeCss (critters/beasties) only runs for the Pages
    // Router in Next 16. App Router needs a post-build pass — see
    // scripts/inline-critical-css.mjs invoked by `npm run build`.
  },
  
  // (webpack block removed — Turbopack is the default builder in Next 16 and
  //  the prior `webpack:` config was silently inert. Turbopack handles
  //  tree-shaking and ESM resolution on its own.)

  // Optimize dev mode
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Cache headers for static assets + security headers applied globally
  // (middleware skips /_next/* so security headers must come from here too).
  async headers() {
    return [
      {
        // Apply CSP + security headers to every response — including
        // /_next/image and /_next/static where middleware does not run.
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/data/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
          },
        ],
      },
    ];
  },
  
  // Redirect /check/* to /web-check/check/* (for web-check internal links)
  async redirects() {
    return [
      {
        source: '/jobs',
        destination: '/careers',
        permanent: true,
      },
      {
        source: '/check',
        destination: '/web-check/check',
        permanent: false,
      },
      {
        source: '/check/:path*',
        destination: '/web-check/check/:path*',
        permanent: false,
      },
      {
        source: '/about',
        destination: '/about-us',
        permanent: true,
      },
    ];
  },
  
  // Proxy web-check app requests to the web-check server
  async rewrites() {
    return {
      beforeFiles: [
        // Redirect /web-check to /web-check/check (skip the homepage redirect issue)
        {
          source: '/web-check',
          destination: 'http://127.0.0.1:3002/web-check/check',
        },
      ],
      afterFiles: [
        {
          source: '/web-check/:path*',
          destination: 'http://127.0.0.1:3002/web-check/:path*',
        },
      ],
    };
  },
  
  // Allow local network access in development
  // Allows accessing dev server from different IPs and network interfaces
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '192.168.66.100',      // Allow specific local network IP
    '192.168.1.0',         // Local network range
    '10.0.0.0',            // Local network range
    '172.16.0.0',          // Local network range
  ],
  
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://rhcsolutions.com',
  },
};

export default nextConfig;
