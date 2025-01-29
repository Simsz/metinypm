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
  
  // If it's a static asset, rewrite to the main domain
  if (url.pathname.startsWith('/_next')) {
    url.protocol = 'https'
    url.host = 'tiny.pm'
    return NextResponse.rewrite(url)
  }

  // For other requests, rewrite to the user's path if username is provided
  if (username) {
    url.pathname = `/${username}${url.pathname}`
  }

  return NextResponse.rewrite(url)
}
 
export async function middleware(request: NextRequest) {
  // Get hostname (e.g. links.simstest.xyz)
  const hostname = request.headers.get('host') || ''
  
  // Only proceed if this is a custom domain
  if (!isCustomDomain(hostname)) {
    return NextResponse.next()
  }

  const normalizedHost = hostname.split(':')[0].toLowerCase()

  // Handle static assets for custom domains
  if (request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/images') ||
      request.nextUrl.pathname.startsWith('/fonts')) {
    return rewriteToMainDomain(request)
  }

  // Skip middleware for api routes, etc
  if (request.nextUrl.pathname.startsWith('/api') || 
      request.nextUrl.pathname.startsWith('/favicon.ico')) {
    return NextResponse.next()
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

    return rewriteToMainDomain(request, data.username)

  } catch (error) {
    console.error('[Middleware] Error:', error)
    return new NextResponse('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}

// Configure middleware matches (include _next now)
export const config = {
  matcher: ['/((?!api/|favicon.ico).*)']
}