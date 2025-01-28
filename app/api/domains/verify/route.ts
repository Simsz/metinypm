// app/api/verify-domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

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
    return new NextResponse('yes', { status: 200 });
  }

  // Allow the main domain and its subdomains
  if (domain === 'tiny.pm' || domain.endsWith('.tiny.pm')) {
    return new NextResponse('yes', { status: 200 });
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

    return Response.json({
      username: customDomain?.user?.username || null
    });

  } catch (error) {
    console.error('Domain verification error:', error);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}