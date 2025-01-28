// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Core application configuration that handles:
 * - Domain and path routing rules
 * - SSL/TLS security settings
 * - Development environment configuration
 * - Cloudflare integration settings
 */
const appConfig = {
  // Domain verification and routing
  domains: {
    public: {
      // Paths that bypass domain verification (prefix matching)
      paths: [
        '/api',
        '/_next',
        '/images',
        '/fonts',
        '/favicon.ico',
        '/dashboard',
      ],
      // Development domains with exact matching for performance
      allowed: new Set([
        'localhost:3131',
        '127.0.0.1:3131',
        'dev.tiny.pm:3131'
      ])
    }
  },

  // SSL/TLS and security configuration
  security: {
    ssl: {
      enforceHttps: true,
      minTlsVersion: '1.2',
      headers: {
        hsts: 'max-age=31536000; includeSubDomains',
        proto: 'https'
      }
    }
  }
} as const;

// Utility functions
const utils = {
  /**
   * Normalizes hostname by removing port and converting to lowercase
   * Ensures consistent hostname comparison across the application
   */
  normalizeHostname(hostname: string): string {
    return hostname.split(':')[0].toLowerCase();
  },

  /**
   * Checks if a path should bypass domain verification
   * Used for static assets and API routes that don't require domain checks
   */
  isPublicPath(pathname: string): boolean {
    return appConfig.domains.public.paths.some(path => pathname.startsWith(path));
  },

  /**
   * Handles Cloudflare-specific SSL/TLS requirements
   * Manages HTTPS enforcement and security headers
   */
  handleCloudflareSSL(request: NextRequest): NextResponse | null {
    try {
      const cfVisitor = JSON.parse(request.headers.get('cf-visitor') || '{}');
      
      if (process.env.NODE_ENV === 'production' && 
          cfVisitor.scheme === 'http' && 
          appConfig.security.ssl.enforceHttps) {
        const secureUrl = new URL(request.url);
        secureUrl.protocol = 'https:';
        return NextResponse.redirect(secureUrl);
      }
    } catch (error) {
      console.error('[SSL] Error parsing cf-visitor:', error);
    }
    return null;
  }
};

export async function middleware(request: NextRequest) {
  // Get hostname and normalize it
  const hostname = request.headers.get('host') || '';
  const normalizedHost = hostname.split(':')[0].toLowerCase();

  // Skip middleware for public paths and API routes
  if (utils.isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Handle root domain and subdomains
  if (normalizedHost === 'tiny.pm' || normalizedHost.endsWith('.tiny.pm')) {
    return NextResponse.next();
  }

  try {
    // Look up custom domain directly from database
    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain: normalizedHost,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!customDomain?.user?.username) {
      console.error('[Middleware] Domain not found:', normalizedHost);
      return NextResponse.redirect(new URL('/404', request.url));
    }

    // Rewrite to the user's page
    const url = request.nextUrl.clone();
    url.pathname = `/${customDomain.user.username}${url.pathname}`;

    console.log('[Middleware] Rewriting custom domain:', {
      from: request.nextUrl.pathname,
      to: url.pathname,
      domain: normalizedHost,
    });

    return NextResponse.rewrite(url);

  } catch (error) {
    console.error('[Middleware] Error:', error);
    return NextResponse.redirect(new URL('/500', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/ routes
     * 2. /_next/ (Next.js internals)
     * 3. /images/ (public files)
     * 4. /favicon.ico, /sitemap.xml (public files)
     */
    '/((?!api/|_next/|images/|favicon.ico|sitemap.xml).*)',
  ],
};