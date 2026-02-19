/**
 * TENANT FILTER HELPER
 * Utility functions for adding siteId filtering
 */

export function withTenant(where: any, siteId?: string | null): any {
  if (siteId) {
    return { ...where, siteId };
  }
  return where;
}

export function withTenantCreate(data: any, siteId?: string | null): any {
  if (siteId) {
    return { ...data, siteId };
  }
  return data;
}

export function getSiteIdFromRequest(req: any): string | null {
  return req?.tenant?.siteId || req?.user?.siteId || null;
}
