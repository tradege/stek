import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';

/**
 * Guard to validate that incoming requests from game providers
 * come from whitelisted IP addresses.
 * 
 * Usage: @UseGuards(ProviderIpGuard)
 * 
 * The guard expects:
 * 1. X-API-KEY header with the provider's API key
 * 2. Request IP to be in the provider's ipWhitelist array
 */
@Injectable()
export class ProviderIpGuard implements CanActivate {
  private readonly logger = new Logger(ProviderIpGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Get API key from header
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      this.logger.warn('Missing X-API-KEY header');
      throw new UnauthorizedException('Missing API key');
    }

    // Get client IP (handle proxies)
    const clientIp = this.getClientIp(request);
    
    if (!clientIp) {
      this.logger.warn('Could not determine client IP');
      throw new UnauthorizedException('Could not determine client IP');
    }

    // Find provider by API key
    const provider = await this.prisma.gameProvider.findFirst({
      where: {
        apiKey,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ipWhitelist: true,
      },
    });

    if (!provider) {
      this.logger.warn(`Invalid API key: ${apiKey.substring(0, 8)}...`);
      throw new UnauthorizedException('Invalid API key');
    }

    // Check IP whitelist (empty whitelist = allow all)
    if (provider.ipWhitelist.length > 0) {
      const isWhitelisted = this.isIpWhitelisted(clientIp, provider.ipWhitelist);
      
      if (!isWhitelisted) {
        this.logger.warn(
          `IP ${clientIp} not whitelisted for provider ${provider.name}`
        );
        throw new UnauthorizedException('IP address not whitelisted');
      }
    }

    // Attach provider info to request for use in controllers
    (request as any).provider = provider;
    
    this.logger.debug(
      `Request from provider ${provider.name} (IP: ${clientIp}) authorized`
    );

    return true;
  }

  /**
   * Get the real client IP, handling proxies and load balancers
   */
  private getClientIp(request: Request): string | null {
    // Check X-Forwarded-For header (common for proxies)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    // Check X-Real-IP header (nginx)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to socket remote address
    return request.socket?.remoteAddress || null;
  }

  /**
   * Check if IP is in whitelist (supports CIDR notation)
   */
  private isIpWhitelisted(ip: string, whitelist: string[]): boolean {
    // Normalize IPv6-mapped IPv4 addresses
    const normalizedIp = this.normalizeIp(ip);

    for (const entry of whitelist) {
      // Check for CIDR notation
      if (entry.includes('/')) {
        if (this.isIpInCidr(normalizedIp, entry)) {
          return true;
        }
      } else {
        // Direct IP comparison
        if (this.normalizeIp(entry) === normalizedIp) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Normalize IP address (handle IPv6-mapped IPv4)
   */
  private normalizeIp(ip: string): string {
    // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    return ip;
  }

  /**
   * Check if IP is within a CIDR range
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bits] = cidr.split('/');
      const mask = parseInt(bits, 10);
      
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);
      const maskNum = ~(2 ** (32 - mask) - 1);
      
      return (ipNum & maskNum) === (rangeNum & maskNum);
    } catch {
      return false;
    }
  }

  /**
   * Convert IP address to number for CIDR comparison
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }
}
