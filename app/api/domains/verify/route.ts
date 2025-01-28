// app/api/verify-domain/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    console.log('[Domain Verify] Request:', {
      url: request.url,
      domain,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });

    if (!domain) {
      console.log('[Domain Verify] No domain provided');
      return Response.json({ error: 'No domain provided' }, { status: 400 });
    }

    // Always allow development domains
    if (
      process.env.NODE_ENV === 'development' &&
      (domain.includes('localhost') ||
        domain.includes('127.0.0.1') ||
        domain.endsWith('.tiny.pm'))
    ) {
      console.log('[Domain Verify] Development domain allowed:', domain);
      return Response.json({ username: 'dev' });
    }

    // Allow the main domain and its subdomains
    if (domain === 'tiny.pm' || domain.endsWith('.tiny.pm')) {
      console.log('[Domain Verify] Main domain allowed:', domain);
      return Response.json({ username: 'root' });
    }

    console.log('[Domain Verify] Looking up domain in database:', domain);
    
    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    console.log('[Domain Verify] Database result:', {
      domain,
      found: !!customDomain,
      username: customDomain?.user?.username,
      status: customDomain?.status
    });

    return Response.json({
      username: customDomain?.user?.username || null
    });

  } catch (error) {
    console.error('[Domain Verify] Error:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      message: error instanceof Error ? error.message : 'Unknown error'
    });

    // Return a more detailed error response
    return Response.json({ 
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.name : typeof error
      } : undefined
    }, { status: 500 });
  }
}