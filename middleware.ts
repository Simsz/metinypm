import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export async function middleware(request: NextRequest) {
  // Get hostname (e.g. links.simstest.xyz)
  const hostname = request.headers.get('host') || ''
  const normalizedHost = hostname.split(':')[0].toLowerCase()

  // Skip middleware for static files, api routes, etc
  if (request.nextUrl.pathname.startsWith('/api') || 
      request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/images') ||
      request.nextUrl.pathname.startsWith('/fonts') ||
      request.nextUrl.pathname.startsWith('/favicon.ico')) {
    return NextResponse.next()
  }

  // Skip IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(normalizedHost)) {
    return NextResponse.next()
  }

  // Handle root domain and subdomains
  if (normalizedHost === 'tiny.pm' || normalizedHost.endsWith('.tiny.pm')) {
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
        'host': 'tiny.pm', // Always use the main domain
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

    // Rewrite to user's page
    const url = request.nextUrl.clone()
    url.pathname = `/${data.username}${request.nextUrl.pathname}`
    
    console.log('[Middleware] Rewriting to:', {
      domain: normalizedHost,
      username: data.username,
      path: url.pathname
    })

    return NextResponse.rewrite(url)

  } catch (error) {
    console.error('[Middleware] Error:', error)
    return new NextResponse('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}

// Configure middleware matches
export const config = {
  matcher: ['/((?!api/|_next/|images/|favicon.ico).*)'],
}