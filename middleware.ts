// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Utility functions
const utils = {
  normalizeHostname(hostname: string): string {
    return hostname.split(':')[0].toLowerCase();
  },

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
  }
};

export async function middleware(request: NextRequest) {
  // Get hostname and normalize it
  const hostname = request.headers.get('host') || '';
  const normalizedHost = utils.normalizeHostname(hostname);

  console.log('[Middleware] Processing request:', {
    host: hostname,
    normalizedHost,
    path: request.nextUrl.pathname,
    method: request.method
  });

  // Skip middleware for public paths
  if (utils.isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Handle root domain and subdomains
  if (normalizedHost === 'tiny.pm' || normalizedHost.endsWith('.tiny.pm')) {
    return NextResponse.next();
  }

  try {
    // Use the verify endpoint
    const verifyUrl = new URL('/api/domains/verify', request.nextUrl.origin);
    verifyUrl.searchParams.set('domain', normalizedHost);
    
    console.log('[Middleware] Verifying domain:', {
      domain: normalizedHost,
      verifyUrl: verifyUrl.toString()
    });

    const response = await fetch(verifyUrl, {
      headers: {
        host: normalizedHost,
        'x-real-ip': request.headers.get('x-real-ip') || '',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'x-forwarded-proto': request.headers.get('x-forwarded-proto') || 'http',
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Middleware] Verification failed:', {
        status: response.status,
        error
      });
      
      if (response.status === 404) {
        return new NextResponse('Domain not found', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      throw new Error(`Domain verification failed: ${error}`);
    }

    const data = await response.json();
    
    if (!data.username) {
      return new NextResponse('Domain not configured', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Rewrite to user's page
    const url = request.nextUrl.clone();
    url.pathname = `/${data.username}${request.nextUrl.pathname}`;
    
    console.log('[Middleware] Rewriting to:', {
      domain: normalizedHost,
      username: data.username,
      path: url.pathname
    });

    return NextResponse.rewrite(url);

  } catch (error) {
    console.error('[Middleware] Error:', error);
    return new NextResponse('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

export const config = {
  matcher: ['/((?!api/|_next/|images/|favicon.ico).*)'],
};