import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AdminActivityInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, ip } = request;
    const userAgent = request.get('user-agent');

    // Only log POST, PUT, DELETE for admin routes
    const isAdminRoute = url.includes('/admin/') || url.includes('/super-admin/');
    const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    return next.handle().pipe(
      tap(async (data) => {
        if (isAdminRoute && isWriteOperation && user) {
          try {
            // Extract targetId from URL if possible (e.g., /admin/users/:id)
            const urlParts = url.split('/');
            const targetId = urlParts[urlParts.length - 1] !== 'admin' ? urlParts[urlParts.length - 1] : undefined;

            await this.auditService.logAction({
              adminId: user.id || user.sub,
              action: `${method} ${url}`,
              targetId: typeof targetId === 'string' ? targetId : undefined,
              entityType: urlParts[2] || 'UNKNOWN',
              details: {
                body: this.sanitizeBody(body),
                response: this.sanitizeResponse(data),
              },
              ipAddress: ip,
              userAgent: userAgent,
            });
          } catch (error) {
            console.error('Failed to log admin activity:', error);
          }
        }
      }),
    );
  }

  private sanitizeBody(body: any) {
    if (!body) return null;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) sanitized[field] = '********';
    });
    return sanitized;
  }

  private sanitizeResponse(data: any) {
    if (!data) return null;
    // Don't log huge responses
    if (Array.isArray(data) && data.length > 10) return { count: data.length };
    return data;
  }
}
