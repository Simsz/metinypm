// app/api/domains/verify/route.ts
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

    // Normalize domain
    const normalizedDomain = domain.toLowerCase().trim();

    // Always allow development domains
    if (
      process.env.NODE_ENV === 'development' &&
      (normalizedDomain.includes('localhost') ||
        normalizedDomain.includes('127.0.0.1') ||
        normalizedDomain.endsWith('.tiny.pm'))
    ) {
      console.log('[Domain Verify] Development domain allowed:', normalizedDomain);
      return Response.json({ username: 'dev' });
    }

    // Allow the main domain and its subdomains
    if (normalizedDomain === 'tiny.pm' || normalizedDomain.endsWith('.tiny.pm')) {
      console.log('[Domain Verify] Main domain allowed:', normalizedDomain);
      return Response.json({ username: 'root' });
    }

    console.log('[Domain Verify] Looking up domain in database:', normalizedDomain);
    
    const customDomain = await prisma.customDomain.findFirst({
      where: {
        domain: normalizedDomain,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    console.log('[Domain Verify] Database result:', {
      domain: normalizedDomain,
      found: !!customDomain,
      username: customDomain?.user?.username,
      status: customDomain?.status
    });

    if (!customDomain?.user?.username) {
      return Response.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    return Response.json({
      username: customDomain.user.username
    });

  } catch (error) {
    console.error('[Domain Verify] Error:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      message: error instanceof Error ? error.message : 'Unknown error'
    });

    return Response.json({ 
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}