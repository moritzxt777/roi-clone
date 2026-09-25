import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Type errors in the cloaker and camouflager modules are fixed and
  // `npm run typecheck` is clean for them.
  //
  // The gate itself is still off because the editor subsystem carries 21
  // pre-existing type errors across 9 API routes, and several are behavioural
  // rather than cosmetic: `auth()` is called with one argument where the current
  // NextAuth beta signature wants two or three, and two Prisma `include`
  // clauses reference relations the schema does not declare, so those handlers
  // silently select nothing at runtime. Turning this on would block deploys on
  // debt outside this change, which is the owner's call, not this file's.
  //
  // Set to false once `npm run typecheck` reports zero errors.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;