// app/api/verify-domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  console.log('[Domain Verify] Request:', {
    domain,
    headers: Object.fromEntries(request.headers.entries())
  });

  if (!domain) {
    return Response.json({ error: 'No domain provided' }, { status: 400 });
  }

  // Always allow development domains
  if (
    process.env.NODE_ENV === 'development' &&
    (domain.includes('localhost') ||
      domain.includes('127.0.0.1') ||
      domain.endsWith('.tiny.pm'))
  ) {
    return Response.json({ username: 'dev' });
  }

  // Allow the main domain and its subdomains
  if (domain === 'tiny.pm' || domain.endsWith('.tiny.pm')) {
    return Response.json({ username: 'root' });
  }

  try {
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

    console.log('[Domain Verify] Found domain:', {
      domain,
      found: !!customDomain,
      username: customDomain?.user?.username
    });

    return Response.json({
      username: customDomain?.user?.username || null
    });

  } catch (error) {
    console.error('[Domain Verify] Error:', error);
    return Response.json({ 
      error: 'Verification failed',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}