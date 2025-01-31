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

  try {
    // Verify domain and get username
    const verifyUrl = `https://tiny.pm/api/domains/verify?domain=${hostname}`;
    const response = await fetch(verifyUrl);
    const data = await response.json();

    if (!data.username) {
      return new NextResponse('Domain not found', { status: 404 });
    }

    // Create the rewrite URL
    const url = request.nextUrl.clone();
    url.pathname = `/${data.username}${request.nextUrl.pathname}`;
    
    return NextResponse.rewrite(url);
  } catch (error) {
    console.error('[Middleware] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ],
};