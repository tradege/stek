import { TipService } from './tip.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  wallet: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tip: {
    create: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('TipService', () => {
  let service: TipService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TipService(mockPrisma as any);

    // Default $transaction mock - executes array of promises
    mockPrisma.$transaction.mockImplementation(async (promises: any) => {
      if (Array.isArray(promises)) {
        return Promise.all(promises);
      }
      if (typeof promises === 'function') {
        return promises(mockPrisma);
      }
      return promises;
    });
  });

  describe('sendTip', () => {
    it('should transfer funds from sender to receiver', async () => {
      const senderId = 'user-sender';
      const receiverId = 'user-receiver';
      const amount = 50;

      // Mock receiver exists and is active
      mockPrisma.user.findUnique.mockImplementation((args: any) => {
        if (args.where.id === receiverId) {
          return Promise.resolve({ id: receiverId, username: 'receiver_user', status: 'ACTIVE' });
        }
        if (args.where.id === senderId) {
          return Promise.resolve({ id: senderId, username: 'sender_user' });
        }
        return Promise.resolve(null);
      });

      // Mock wallets
      mockPrisma.wallet.findFirst.mockImplementation((args: any) => {
        if (args.where.userId === senderId) {
          return Promise.resolve({ id: 'wallet-sender', balance: 1000, userId: senderId });
        }
        if (args.where.userId === receiverId) {
          return Promise.resolve({ id: 'wallet-receiver', balance: 200, userId: receiverId });
        }
        return Promise.resolve(null);
      });

      // Mock transaction operations
      mockPrisma.tip.create.mockResolvedValue({
        id: 'tip-001',
        senderId,
        receiverId,
        amount,
      });
      mockPrisma.wallet.update.mockResolvedValue({});
      mockPrisma.transaction.create.mockResolvedValue({});

      // $transaction returns array of results
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'tip-001', senderId, receiverId, amount },
        {},
        {},
        {},
        {},
      ]);

      const result = await service.sendTip(senderId, receiverId, amount);
      expect(result).toBeDefined();
      expect(result.tipId).toBe('tip-001');
      expect(result.from.userId).toBe(senderId);
      expect(result.to.userId).toBe(receiverId);
      expect(result.amount).toBe('50');
    });

    it('should reject tipping yourself', async () => {
      const userId = 'user-self';

      await expect(
        service.sendTip(userId, userId, 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject tip below minimum amount', async () => {
      await expect(
        service.sendTip('sender', 'receiver', 0.001),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when receiver not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendTip('sender', 'nonexistent', 50),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when receiver is not active', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'banned-user',
        username: 'banned',
        status: 'BANNED',
      });

      await expect(
        service.sendTip('sender', 'banned-user', 50),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when sender has insufficient balance', async () => {
      // Receiver exists
      mockPrisma.user.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'receiver') {
          return Promise.resolve({ id: 'receiver', username: 'recv', status: 'ACTIVE' });
        }
        if (args.where.id === 'sender') {
          return Promise.resolve({ id: 'sender', username: 'send' });
        }
        return null;
      });

      // Sender wallet with low balance
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'wallet-poor',
        balance: 10,
        userId: 'sender',
      });

      await expect(
        service.sendTip('sender', 'receiver', 1000),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveUsername', () => {
    it('should resolve username to user ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
      });

      const result = await service.resolveUsername('testplayer');
      expect(result).toBe('user-123');
    });

    it('should return null for non-existent username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resolveUsername('nonexistent');
      expect(result).toBeNull();
    });

    it('should strip @ prefix from username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123' });

      await service.resolveUsername('@testplayer');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testplayer' },
        select: { id: true },
      });
    });
  });

  describe('atomic wallet transfer', () => {
    it('should use $transaction for atomic operations', async () => {
      // Setup all mocks for a successful tip
      mockPrisma.user.findUnique.mockImplementation((args: any) => {
        if (args.where.id === 'receiver') {
          return Promise.resolve({ id: 'receiver', username: 'recv', status: 'ACTIVE' });
        }
        return Promise.resolve({ id: 'sender', username: 'send' });
      });

      mockPrisma.wallet.findFirst.mockImplementation((args: any) => {
        if (args.where.userId === 'sender') {
          return Promise.resolve({ id: 'w-send', balance: 1000, userId: 'sender' });
        }
        return Promise.resolve({ id: 'w-recv', balance: 100, userId: 'receiver' });
      });

      mockPrisma.$transaction.mockResolvedValue([
        { id: 'tip-1' }, {}, {}, {}, {},
      ]);

      await service.sendTip('sender', 'receiver', 50);

      // Verify $transaction was called (atomic operation)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
