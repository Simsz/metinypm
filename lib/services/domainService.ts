// lib/services/domainService.ts
import { CustomDomain, DomainStatus, Subscription, User } from '@prisma/client';
import prisma from '@/lib/prisma';
import dns from 'dns/promises';

interface UserWithSubscription extends User {
    subscription: Subscription | null;
}

export class DomainVerificationError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'DomainVerificationError';
    }
}

export class DomainService {
    private static MAX_VERIFICATION_ATTEMPTS = 5;
    private static VERIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes

    static async addDomain(userId: string, domain: string): Promise<CustomDomain> {
        // Normalize domain
        domain = domain.toLowerCase().trim();
        
        // Basic validation
        if (!this.isValidDomain(domain)) {
            throw new DomainVerificationError('Invalid domain format', 'INVALID_FORMAT');
        }

        // Check if domain is available
        const existing = await prisma.customDomain.findUnique({ where: { domain } });
        if (existing) {
            throw new DomainVerificationError('Domain already registered', 'ALREADY_EXISTS');
        }

        // Check user's subscription status
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true }
        }) as UserWithSubscription | null;

        if (!user) {
            throw new DomainVerificationError('User not found', 'USER_NOT_FOUND');
        }

        if (!user.subscription || user.subscription.status !== 'ACTIVE') {
            throw new DomainVerificationError('Active subscription required', 'SUBSCRIPTION_REQUIRED');
        }

        // Generate verification code
        const verificationCode = await this.generateVerificationCode();

        // Create domain record with CNAME target
        return prisma.customDomain.create({
            data: {
                domain,
                userId,
                verificationCode,
                subscriptionId: user.subscription.id,
                status: DomainStatus.PENDING,
                cnameTarget: 'tiny.pm',
            }
        });
    }

  static async verifyDomain(domainId: string): Promise<CustomDomain> {
    const domain = await prisma.customDomain.findUnique({ 
      where: { id: domainId } 
    });

    if (!domain) {
      throw new DomainVerificationError('Domain not found', 'NOT_FOUND');
    }

    // Check attempt cooldown
    if (domain.lastAttemptAt) {
      const cooldownRemaining = Date.now() - domain.lastAttemptAt.getTime();
      if (cooldownRemaining < this.VERIFICATION_COOLDOWN) {
        throw new DomainVerificationError(
          `Please wait ${Math.ceil((this.VERIFICATION_COOLDOWN - cooldownRemaining) / 1000)} seconds before retrying`,
          'COOLDOWN'
        );
      }
    }

    // Check maximum attempts
    if (domain.verificationAttempts >= this.MAX_VERIFICATION_ATTEMPTS) {
      throw new DomainVerificationError('Maximum verification attempts exceeded', 'MAX_ATTEMPTS');
    }

    try {
      // Update attempt counter
      await prisma.customDomain.update({
        where: { id: domain.id },
        data: {
          verificationAttempts: { increment: 1 },
          lastAttemptAt: new Date(),
          status: DomainStatus.DNS_VERIFICATION,
        }
      });

      // Verify CNAME record
      const records = await dns.resolveCname(domain.domain);
      
      const validTargets = ['tiny.pm', 'origin.tiny.pm'];
      if (!records.some(record => validTargets.includes(record))) {
        throw new DomainVerificationError(
          `CNAME record should point to either tiny.pm or origin.tiny.pm`,
          'INVALID_CNAME'
        );
      }

      // Update domain status
      return prisma.customDomain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.ACTIVE,
          verifiedAt: new Date(),
          errorMessage: null,
        }
      });

    } catch (error) {
      // Update domain with error
      await prisma.customDomain.update({
        where: { id: domain.id },
        data: {
          status: DomainStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        }
      });

      throw error;
    }
  }

  private static isValidDomain(domain: string): boolean {
    const domainRegex = /^(?!:\/\/)(?:[a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;
    return domainRegex.test(domain) && !domain.includes('tiny.pm');
  }

  private static async generateVerificationCode(): Promise<string> {
    const code = crypto.randomUUID();
    // Ensure uniqueness
    const existing = await prisma.customDomain.findUnique({
      where: { verificationCode: code }
    });
    if (existing) {
      return this.generateVerificationCode();
    }
    return code;
  }
}