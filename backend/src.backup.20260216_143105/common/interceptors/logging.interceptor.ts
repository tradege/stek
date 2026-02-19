import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = (request as any).user?.id || 'anonymous';
    
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const contentLength = response.get('content-length') || 0;
          const responseTime = Date.now() - now;

          // Log successful requests
          this.logger.log({
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode,
            contentLength,
            responseTime: `${responseTime}ms`,
            ip,
            userAgent,
            userId,
          });
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          
          // Log failed requests
          this.logger.error({
            timestamp: new Date().toISOString(),
            method,
            url,
            error: error.message,
            responseTime: `${responseTime}ms`,
            ip,
            userAgent,
            userId,
          });
        },
      }),
    );
  }
}
