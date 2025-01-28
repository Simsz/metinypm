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
    return [
      '/api', 
      '/_next', 
      '/images', 
      '/fonts', 
      '/favicon.ico',
      '/404',
      '/500'
    ].some(path => pathname.startsWith(path));
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
  const normalizedHost = utils.normalizeHostname(hostname);

  // Skip middleware for public paths and error pages
  if (utils.isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Handle root domain and subdomains
  if (normalizedHost === 'tiny.pm' || normalizedHost.endsWith('.tiny.pm')) {
    return NextResponse.next();
  }

  try {
    // Look up custom domain
    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain: normalizedHost,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    if (!customDomain?.user?.username) {
      return new NextResponse(`Domain not found: ${normalizedHost}`, { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Simple rewrite to user's page
    const url = request.nextUrl.clone();
    url.pathname = `/${customDomain.user.username}`;
    
    // Create response with rewrite, allowing both HTTP and HTTPS
    const response = NextResponse.rewrite(url);
    
    // Remove any headers that might force HTTPS
    response.headers.delete('Strict-Transport-Security');
    response.headers.delete('X-Forwarded-Proto');
    
    return response;

  } catch (error) {
    const errorDetails = `
Error Details:
-------------
Message: ${error instanceof Error ? error.message : 'Unknown error'}
Name: ${error instanceof Error ? error.name : 'Unknown'}
Stack: ${error instanceof Error ? error.stack : 'No stack trace'}

Request Details:
---------------
Host: ${normalizedHost}
Path: ${request.nextUrl.pathname}
Protocol: ${request.nextUrl.protocol}
Headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2)}

Timestamp: ${new Date().toISOString()}
    `;

    return new NextResponse(errorDetails, { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
}

export const config = {
  matcher: ['/((?!api/|_next/|images/|favicon.ico).*)'],
};