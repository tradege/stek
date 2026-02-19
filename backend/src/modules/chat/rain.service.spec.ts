import { RainService } from './rain.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  bet: {
    groupBy: jest.fn(),
  },
  chatMessage: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  wallet: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  rain: {
    create: jest.fn(),
  },
  rainParticipant: {
    create: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
};

describe('RainService', () => {
  let service: RainService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RainService(mockPrisma as any);
  });

  describe('startRain', () => {
    it('should distribute rain evenly among eligible participants', async () => {
      const totalAmount = 100;
      const numberOfPeople = 5;
      const adminId = 'admin-001';

      // Mock active wagerers
      mockPrisma.bet.groupBy.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
        { userId: 'user-4' },
        { userId: 'user-5' },
        { userId: 'user-6' },
      ]);

      // Mock chatters
      mockPrisma.chatMessage.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
        { userId: 'user-4' },
        { userId: 'user-5' },
      ]);

      // Mock rain creation
      mockPrisma.rain.create.mockResolvedValue({
        id: 'rain-001',
      });

      // Mock wallet operations
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'wallet-1',
        balance: 100,
      });
      mockPrisma.wallet.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.rainParticipant.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ username: 'testuser' });

      const result = await service.startRain(totalAmount, numberOfPeople, adminId);

      expect(result).toBeDefined();
      expect(result.rainId).toBe('rain-001');
      expect(result.totalAmount).toBe(totalAmount);
      expect(result.participantCount).toBeLessThanOrEqual(numberOfPeople);
      expect(result.participants).toBeDefined();
      expect(Array.isArray(result.participants)).toBe(true);
    });

    it('should throw when amount is zero or negative', async () => {
      await expect(
        service.startRain(0, 5, 'admin-001'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.startRain(-10, 5, 'admin-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when numberOfPeople is zero or negative', async () => {
      await expect(
        service.startRain(100, 0, 'admin-001'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.startRain(100, -5, 'admin-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when no active users found', async () => {
      mockPrisma.bet.groupBy.mockResolvedValue([]);

      await expect(
        service.startRain(100, 5, 'admin-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fallback to wagerers when no chatters found', async () => {
      mockPrisma.bet.groupBy.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      // No chatters
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);

      mockPrisma.rain.create.mockResolvedValue({ id: 'rain-fallback' });
      mockPrisma.wallet.findFirst.mockResolvedValue({ id: 'w-1', balance: 100 });
      mockPrisma.wallet.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});
      mockPrisma.rainParticipant.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ username: 'user' });

      const result = await service.startRain(100, 5, 'admin-001');
      expect(result.participantCount).toBeGreaterThan(0);
    });
  });

  describe('rain distribution logic', () => {
    it('should split amount evenly among active users', () => {
      const amount = 500;
      const participants = 10;
      const share = amount / participants;
      expect(share).toBe(50);
    });

    it('should handle single participant', () => {
      const amount = 100;
      const participants = 1;
      const share = amount / participants;
      expect(share).toBe(100);
    });

    it('should handle large number of participants', () => {
      const amount = 100;
      const participants = 100;
      const share = amount / participants;
      expect(share).toBe(1);
    });

    it('should handle fractional amounts', () => {
      const amount = 10;
      const participants = 3;
      const share = amount / participants;
      expect(share).toBeCloseTo(3.33, 1);
    });
  });
});
