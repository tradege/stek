import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(data: {
    adminId: string;
    action: string;
    targetId?: string;
    entityType?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        targetId: data.targetId,
        entityType: data.entityType,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async getLogs(limit: number = 100, offset: number = 0, siteId?: string) {
    return this.prisma.auditLog.findMany({
      ...(siteId && { where: { siteId } }),
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      // Include admin details if there's a relation, but for now just the raw logs
    });
  }
}
