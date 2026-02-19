/**
 * ============================================
 * TENANT INTERCEPTOR - Multi-Tenancy Core
 * ============================================
 * Extracts siteId from request headers or origin domain.
 * Injects it into the request object for all downstream services.
 * Works for both HTTP and WebSocket requests.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

export interface TenantRequest {
  siteId: string;
  siteDomain: string;
  siteConfig: any;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  // Cache site configs to avoid DB lookups on every request
  private siteCache: Map<string, { config: any; cachedAt: number }> = new Map();
  private readonly CACHE_TTL = 60_000; // 1 minute cache

  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const contextType = context.getType();

    let siteId: string | null = null;
    let origin: string | null = null;

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest();
      siteId = request.headers['x-site-id'] || null;
      origin = request.headers['origin'] || request.headers['host'] || null;

      // Resolve siteId from origin domain if not provided in header
      if (!siteId && origin) {
        const config = await this.resolveSiteByDomain(origin);
        if (config) {
          siteId = config.id;
        }
      }

      // Inject tenant info into request
      if (siteId) {
        const siteConfig = await this.getSiteConfig(siteId);
        if (siteConfig && siteConfig.active) {
          request.tenant = {
            siteId: siteConfig.id,
            siteDomain: siteConfig.domain,
            siteConfig,
          } as TenantRequest;
        } else if (siteConfig && !siteConfig.active) {
          throw new BadRequestException('This brand is currently inactive.');
        }
      }

      // For ADMIN role, allow operating without siteId (global access)
      // This is checked downstream in services
    } else if (contextType === 'ws') {
      const client = context.switchToWs().getClient();
      const handshake = client.handshake;

      siteId = handshake?.headers?.['x-site-id'] || 
               handshake?.query?.siteId || 
               null;
      origin = handshake?.headers?.origin || null;

      // Resolve siteId from origin domain if not provided
      if (!siteId && origin) {
        const config = await this.resolveSiteByDomain(origin);
        if (config) {
          siteId = config.id;
        }
      }

      // Inject tenant info into socket data
      if (siteId) {
        const siteConfig = await this.getSiteConfig(siteId);
        if (siteConfig && siteConfig.active) {
          client.data = client.data || {};
          client.data.tenant = {
            siteId: siteConfig.id,
            siteDomain: siteConfig.domain,
            siteConfig,
          } as TenantRequest;
        }
      }
    }

    return next.handle();
  }

  /**
   * Resolve site configuration by domain name
   */
  private async resolveSiteByDomain(origin: string): Promise<any | null> {
    try {
      // Extract domain from origin (remove protocol and port)
      let domain = origin
        .replace(/^https?:\/\//, '')
        .replace(/:\d+$/, '')
        .toLowerCase();

      // Check cache first
      const cacheKey = `domain:${domain}`;
      const cached = this.siteCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
        return cached.config;
      }

      const config = await this.prisma.siteConfiguration.findFirst({
        where: {
          domain: domain,
          active: true,
        },
      });

      if (config) {
        this.siteCache.set(cacheKey, { config, cachedAt: Date.now() });
        this.siteCache.set(`id:${config.id}`, { config, cachedAt: Date.now() });
      }

      return config;
    } catch (error) {
      this.logger.error(`Failed to resolve site by domain: ${origin}`, error);
      return null;
    }
  }

  /**
   * Get site configuration by siteId (with caching)
   */
  private async getSiteConfig(siteId: string): Promise<any | null> {
    try {
      const cacheKey = `id:${siteId}`;
      const cached = this.siteCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
        return cached.config;
      }

      const config = await this.prisma.siteConfiguration.findUnique({
        where: { id: siteId },
      });

      if (config) {
        this.siteCache.set(cacheKey, { config, cachedAt: Date.now() });
        this.siteCache.set(`domain:${config.domain}`, { config, cachedAt: Date.now() });
      }

      return config;
    } catch (error) {
      this.logger.error(`Failed to get site config: ${siteId}`, error);
      return null;
    }
  }

  /**
   * Clear the site configuration cache (call when admin updates a brand)
   */
  clearCache(siteId?: string) {
    if (siteId) {
      // Clear specific site
      for (const [key, value] of this.siteCache.entries()) {
        if (value.config?.id === siteId) {
          this.siteCache.delete(key);
        }
      }
    } else {
      this.siteCache.clear();
    }
  }
}
