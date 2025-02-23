// app/api/domains/[id]/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import dns from 'dns/promises';

const VERIFICATION_SETTINGS = {
  COOLDOWN_MS: 5 * 60 * 1000,
  MAX_ATTEMPTS: 5,
  DNS_TIMEOUT_MS: 10000,
  ALLOWED_STATUS_TRANSITIONS: new Set(['PENDING', 'DNS_VERIFICATION', 'FAILED']),
} as const;

// Comprehensive logging helper for DNS verification
async function verifyDnsRecords(domain: string, expectedTarget: string) {
  console.log('[DNS Verification] Starting verification:', {
    domain,
    expectedTarget,
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
  });

  try {
    // Log the DNS servers being used
    const nameservers = dns.getServers();
    console.log('[DNS Verification] Using nameservers:', nameservers);

    const records = await dns.resolveCname(domain);
    const validTargets = ['tiny.pm', 'origin.tiny.pm'];
    const matches = records.some(record => validTargets.includes(record));

    console.log('[DNS Verification] Resolved CNAME records:', {
      domain,
      records,
      validTargets,
      matches,
    });

    return records;
  } catch (error) {
    // Enhanced error logging
    console.error('[DNS Verification] Resolution failed:', {
      domain,
      expectedTarget,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        code: (error as NodeJS.ErrnoException).code,
        stack: error.stack,
      } : error,
    });
    throw error;
  }
}

function isDnsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function formatDnsError(error: NodeJS.ErrnoException): string {
  const errorMessages: Record<string, string> = {
    ENODATA: 'No DNS records found. Please ensure you have added the CNAME record pointing to either tiny.pm or origin.tiny.pm.',
    ENOTFOUND: 'Domain not found. Please check if the domain exists and try again.',
    ETIMEOUT: 'DNS lookup timed out. Please try again in a few minutes.',
    ESERVFAIL: 'DNS server error. Please check your DNS configuration.',
  };

  // Log detailed error information for debugging
  console.error('[DNS Error] Formatted error details:', {
    code: error.code,
    message: error.message,
    formattedMessage: errorMessages[error.code ?? ''],
  });

  return errorMessages[error.code ?? ''] || 'DNS verification failed. Please check your configuration.';
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  console.log('[Domain Verification] Starting verification request:', {
    requestId,
    url: request.nextUrl.pathname,
    timestamp: new Date().toISOString(),
  });

  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pathParts = request.nextUrl.pathname.split('/');
    const idIndex = pathParts.length - 2;
    const id = pathParts[idIndex];

    if (!id?.trim()) {
      return NextResponse.json({ error: 'Invalid domain ID' }, { status: 400 });
    }

    // Log the domain fetch attempt
    console.log('[Domain Verification] Fetching domain:', {
      requestId,
      domainId: id,
      userId: session.user.id,
    });

    const domain = await prisma.customDomain.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            subscription: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    // Log the fetched domain details
    console.log('[Domain Verification] Domain details:', {
      requestId,
      domain: domain ? {
        id: domain.id,
        domainName: domain.domain,
        status: domain.status,
        cnameTarget: domain.cnameTarget,
        attempts: domain.verificationAttempts,
      } : null,
      subscriptionStatus: domain?.user.subscription?.status,
    });

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    if (!domain.user.subscription || domain.user.subscription.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'Active subscription required',
          code: 'SUBSCRIPTION_REQUIRED',
        },
        { status: 402 }
      );
    }

    // Remaining validation logic...
    // [Previous validation code remains the same]

    try {
      // Enhanced DNS verification with timeout and logging
      const records = await Promise.race([
        verifyDnsRecords(domain.domain, domain.cnameTarget),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('DNS lookup timed out')), 
            VERIFICATION_SETTINGS.DNS_TIMEOUT_MS);
        }),
      ]) as string[];

      if (!records.includes(domain.cnameTarget)) {
        const failureMessage = `CNAME record must point to ${domain.cnameTarget}`;
        console.log('[Domain Verification] Validation failed:', {
          requestId,
          domain: domain.domain,
          expected: domain.cnameTarget,
          actual: records,
        });

        await prisma.customDomain.update({
          where: { id },
          data: {
            status: 'FAILED',
            errorMessage: failureMessage,
          },
        });

        return NextResponse.json(
          {
            error: `Invalid CNAME configuration. Expected ${domain.cnameTarget}`,
            code: 'INVALID_CNAME',
          },
          { status: 400 }
        );
      }

      // Success case
      console.log('[Domain Verification] Verification successful:', {
        requestId,
        domain: domain.domain,
        cnameTarget: domain.cnameTarget,
      });

      const verifiedDomain = await prisma.customDomain.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          verifiedAt: new Date(),
          errorMessage: null,
        },
      });

      return NextResponse.json(verifiedDomain);

    } catch (error) {
      const errorMessage = isDnsError(error) 
        ? formatDnsError(error)
        : 'DNS verification failed';

      console.error('[Domain Verification] Verification error:', {
        requestId,
        domain: domain.domain,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          code: (error as NodeJS.ErrnoException).code,
        } : error,
      });

      await prisma.customDomain.update({
        where: { id },
        data: {
          status: 'FAILED',
          errorMessage: errorMessage,
        },
      });

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'DNS_ERROR',
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[Domain Verification] Unexpected error:', {
      requestId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: 'An unexpected error occurred during domain verification',
        code: 'INTERNAL_ERROR',
        requestId,
      },
      { status: 500 }
    );
  }
}