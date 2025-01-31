import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isCustomDomain(hostname: string): boolean {
  const normalizedHost = hostname.split(':')[0].toLowerCase()
  return !(
    normalizedHost === 'tiny.pm' || 
    normalizedHost.endsWith('.tiny.pm') ||
    normalizedHost === 'localhost' ||
    normalizedHost.includes('192.') ||
    normalizedHost.includes('127.0.0.1')
  )
}

function rewriteToMainDomain(request: NextRequest, username: string | null = null) {
  const url = request.nextUrl.clone()
  
  // If it's a static asset, inject tiny.pm into the URL
  if (url.pathname.startsWith('/_next')) {
    const response = NextResponse.next()
    
    // Rewrite the HTML to point static assets to tiny.pm
    response.headers.set(
      'Link',
      `<https://tiny.pm${url.pathname}>; rel=preload; as=${getAssetType(url.pathname)}`
    )
    
    return response
  }

  // For other requests, rewrite to the user's path if username is provided
  if (username) {
    url.pathname = `/${username}${url.pathname}`
  }

  const response = NextResponse.rewrite(url)

  // Add header to tell the client to load assets from tiny.pm
  response.headers.set('X-Asset-Domain', 'https://tiny.pm')

  return response
}

function getAssetType(pathname: string): string {
  if (pathname.endsWith('.js')) return 'script'
  if (pathname.endsWith('.css')) return 'style'
  if (pathname.endsWith('.woff') || pathname.endsWith('.woff2')) return 'font'
  if (pathname.endsWith('.png') || pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.gif') || pathname.endsWith('.webp')) return 'image'
  return 'fetch'
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Only proceed if this is a custom domain
  if (!isCustomDomain(hostname)) {
    return NextResponse.next();
  }

  const normalizedHost = hostname.split(':')[0].toLowerCase();

  // For static assets, redirect to tiny.pm
  if (request.nextUrl.pathname.startsWith('/_next') || 
      request.nextUrl.pathname.startsWith('/images/')) {
    const url = new URL(request.url);
    url.host = 'tiny.pm';
    url.protocol = 'https';
    return NextResponse.rewrite(url);
  }

  // Skip middleware for api routes, etc
  if (request.nextUrl.pathname.startsWith('/api') || 
      request.nextUrl.pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  // For custom domains, verify and rewrite
  try {
    console.log('[Middleware] Processing request:', {
      host: hostname,
      normalizedHost,
      path: request.nextUrl.pathname,
      method: request.method
    })

    // Always use https://tiny.pm for verification in production
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://tiny.pm'
      : request.nextUrl.origin
    
    const verifyUrl = new URL('/api/domains/verify', baseUrl)
    verifyUrl.searchParams.set('domain', normalizedHost)
    
    console.log('[Middleware] Verifying domain:', {
      domain: normalizedHost,
      verifyUrl: verifyUrl.toString()
    })

    // Fetch the verification endpoint
    const response = await fetch(verifyUrl, {
      headers: {
        'host': 'tiny.pm',
        'x-real-ip': request.headers.get('x-real-ip') || '',
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'x-forwarded-proto': request.headers.get('x-forwarded-proto') || 'http',
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Middleware] Verification failed:', {
        status: response.status,
        error
      })
      
      if (response.status === 404) {
        return new NextResponse('Domain not found', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        })
      }
      
      throw new Error(`Domain verification failed: ${error}`)
    }

    const data = await response.json()
    
    if (!data.username) {
      return new NextResponse('Domain not configured', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    console.log('[Middleware] Rewriting to:', {
      domain: normalizedHost,
      username: data.username,
      path: `/${data.username}${request.nextUrl.pathname}`
    })

    // Create base response
    const url = request.nextUrl.clone();
    url.pathname = `/${data.username}${request.nextUrl.pathname}`;
    
    const rewriteResponse = NextResponse.rewrite(url);
    
    // Add header to ensure assets are loaded from tiny.pm
    rewriteResponse.headers.set('X-Asset-Prefix', 'https://tiny.pm');
    
    // Add security headers (simplified CSP that points to tiny.pm)
    rewriteResponse.headers.set(
      'Content-Security-Policy',
      "default-src 'self' https://tiny.pm; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://tiny.pm; style-src 'self' 'unsafe-inline' https://tiny.pm; font-src 'self' data: https://tiny.pm; img-src 'self' data: https://tiny.pm https://*.googleusercontent.com https://avatars.githubusercontent.com; connect-src 'self' https://tiny.pm"
    );

    return rewriteResponse;
  } catch (error) {
    console.error('[Middleware] Error:', error);
    return new NextResponse('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Update config to include static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    // Add matcher for static assets that should be rewritten
    '/_next/static/:path*',
    '/images/:path*'
  ],
};