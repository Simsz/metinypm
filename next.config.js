/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    //ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Add crossOrigin configuration
  crossOrigin: 'anonymous',
  
  // Add assetPrefix for production
  assetPrefix: process.env.NODE_ENV === 'production' ? 'https://tiny.pm' : undefined,
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Update CSP to be more permissive for custom domains
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self' https://tiny.pm; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://tiny.pm; style-src 'self' 'unsafe-inline' https://tiny.pm; font-src 'self' data: https://tiny.pm; img-src 'self' data: https://tiny.pm https://*.googleusercontent.com https://avatars.githubusercontent.com; connect-src 'self' https://tiny.pm`.replace(/\s+/g, ' ').trim()
          }
        ],
      },
      {
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      }
    ];
  },
  // Add assetPrefix configuration
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/_next/:path*',
          destination: 'https://tiny.pm/_next/:path*'
        },
        {
          source: '/images/:path*',
          destination: 'https://tiny.pm/images/:path*'
        }
      ]
    };
  }
};

module.exports = nextConfig;