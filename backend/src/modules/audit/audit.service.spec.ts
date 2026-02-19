import { AuditService } from './audit.service';

// Mock PrismaService
const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(mockPrisma as any);
  });

  describe('logAction (audit log creation)', () => {
    it('should create an audit log entry with all fields', async () => {
      const logData = {
        adminId: 'admin-001',
        action: 'BAN_USER',
        entityType: 'User',
        targetId: 'user-123',
        details: { reason: 'Fraud detected' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'log-001',
        ...logData,
        createdAt: new Date(),
      });

      await service.logAction(logData);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          action: 'BAN_USER',
          targetId: 'user-123',
          entityType: 'User',
          details: { reason: 'Fraud detected' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should create audit log with minimal required fields', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'log-002',
        adminId: 'admin-001',
        action: 'VIEW_DASHBOARD',
        createdAt: new Date(),
      });

      await service.logAction({
        adminId: 'admin-001',
        action: 'VIEW_DASHBOARD',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-001',
          action: 'VIEW_DASHBOARD',
          targetId: undefined,
          entityType: undefined,
          details: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should store JSON details correctly', async () => {
      const complexDetails = {
        oldBalance: 100,
        newBalance: 200,
        adjustmentReason: 'VIP bonus',
        approvedBy: 'super-admin',
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-003' });

      await service.logAction({
        adminId: 'admin-001',
        action: 'ADJUST_BALANCE',
        details: complexDetails,
      });

      const createCall = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.details).toEqual(complexDetails);
    });

    it('should handle different action types', async () => {
      const actions = [
        'BAN_USER',
        'UNBAN_USER',
        'ADJUST_BALANCE',
        'CHANGE_VIP_LEVEL',
        'APPROVE_WITHDRAWAL',
        'REJECT_WITHDRAWAL',
        'UPDATE_CONFIG',
      ];

      for (const action of actions) {
        mockPrisma.auditLog.create.mockResolvedValue({ id: `log-${action}` });
        await service.logAction({ adminId: 'admin-001', action });
      }

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(actions.length);
    });
  });

  describe('getLogs (querying/filtering)', () => {
    it('should return audit logs with default pagination', async () => {
      const mockLogs = [
        { id: 'log-1', adminId: 'admin-1', action: 'BAN_USER', createdAt: new Date() },
        { id: 'log-2', adminId: 'admin-1', action: 'ADJUST_BALANCE', createdAt: new Date() },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getLogs();

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should support custom limit and offset', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.getLogs(50, 10);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 10,
        }),
      );
    });

    it('should order logs by createdAt descending (newest first)', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.getLogs();

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return empty array when no logs exist', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getLogs();
      expect(result).toEqual([]);
    });

    it('should handle large offset values', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.getLogs(100, 10000);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 10000,
        }),
      );
    });
  });

  describe('admin activity interceptor pattern', () => {
    it('should track admin ID for every action', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-track' });

      await service.logAction({
        adminId: 'admin-specific-123',
        action: 'SOME_ACTION',
      });

      const createCall = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.adminId).toBe('admin-specific-123');
    });

    it('should capture IP address and user agent', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-ip' });

      await service.logAction({
        adminId: 'admin-001',
        action: 'LOGIN',
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/120.0',
      });

      const createCall = mockPrisma.auditLog.create.mock.calls[0][0];
      expect(createCall.data.ipAddress).toBe('10.0.0.1');
      expect(createCall.data.userAgent).toBe('Chrome/120.0');
    });
  });
});
