/**
 * ============================================
 * TENANT DECORATOR
 * ============================================
 * Custom parameter decorator to extract tenant info
 * from the request object in controllers.
 * 
 * Usage:
 *   @Get('users')
 *   getUsers(@CurrentTenant() tenant: TenantRequest) { ... }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantRequest } from '../interceptors/tenant.interceptor';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantRequest | null => {
    const contextType = ctx.getType();

    if (contextType === 'http') {
      const request = ctx.switchToHttp().getRequest();
      return request.tenant || null;
    } else if (contextType === 'ws') {
      const client = ctx.switchToWs().getClient();
      return client.data?.tenant || null;
    }

    return null;
  },
);

/**
 * Helper to extract siteId from various contexts
 * Used in services that need the siteId
 */
export function extractSiteId(context: ExecutionContext): string | null {
  const contextType = context.getType();

  if (contextType === 'http') {
    const request = context.switchToHttp().getRequest();
    return request.tenant?.siteId || null;
  } else if (contextType === 'ws') {
    const client = context.switchToWs().getClient();
    return client.data?.tenant?.siteId || null;
  }

  return null;
}
