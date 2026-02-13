import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * SUPER ADMIN GUARD
 * Only allows the platform owner (marketedgepros@gmail.com) to access super-admin routes.
 * White-label admins with ADMIN role cannot access these routes.
 */
const SUPER_ADMIN_EMAIL = 'marketedgepros@gmail.com';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (user.email !== SUPER_ADMIN_EMAIL) {
      throw new ForbiddenException('Access denied: Super Admin only');
    }

    return true;
  }
}
