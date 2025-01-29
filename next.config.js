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
  // Remove the rewrites since we're handling this in middleware now
  // async rewrites() {
  //   return {
  //     beforeFiles: [
  //       {
  //         source: '/:path*',
  //         has: [
  //           {
  //             type: 'host',
  //             value: '(?!tiny\\.pm|localhost).*',
  //           },
  //         ],
  //         destination: '/api/proxy/:path*',
  //       },
  //     ],
  //   };
  // },
  async headers() {
    return [
      {
        // Match all routes
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          // More specific CORS settings
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://tiny.pm'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Accept'
          },
          // Add CSP header
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' https://tiny.pm; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://tiny.pm; style-src 'self' 'unsafe-inline' https://tiny.pm; font-src 'self' https://tiny.pm; img-src 'self' data: https://tiny.pm https://*.googleusercontent.com https://avatars.githubusercontent.com;"
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          }
        ],
      },
      {
        // Special headers for static assets
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'  // Allow assets to be loaded from anywhere
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },
    ];
  },
  // Add assetPrefix for production
  ...(process.env.NODE_ENV === 'production' ? {
    assetPrefix: 'https://tiny.pm'
  } : {}),
};

module.exports = nextConfig;