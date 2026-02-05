import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { GameCategory, SessionStatus } from '@prisma/client';

describe('GamesService', () => {
  let service: GamesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    game: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
    },
    gameProvider: {
      findMany: jest.fn(),
    },
    gameSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGame = {
    id: 'game-1',
    name: 'Sweet Bonanza',
    slug: 'sweet-bonanza',
    externalId: 'vs20fruitsw',
    category: GameCategory.SLOTS,
    thumbnail: 'https://example.com/sweet-bonanza.jpg',
    isActive: true,
    isHot: true,
    isNew: false,
    isFeatured: true,
    sortOrder: 1,
    provider: {
      id: 'provider-1',
      name: 'Pragmatic Play',
      slug: 'pragmatic-play',
      isLive: true,
    },
  };

  const mockInternalGame = {
    ...mockGame,
    id: 'game-2',
    name: 'Crash',
    slug: 'crash',
    provider: {
      id: 'provider-internal',
      name: 'Internal',
      slug: 'internal',
      isLive: true,
    },
  };

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    gameId: 'game-1',
    externalSessionId: 'uuid-123',
    currency: 'USDT',
    status: SessionStatus.ACTIVE,
    totalBet: 0,
    totalWin: 0,
    startedAt: new Date(),
    endedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated games with default filters', async () => {
      const mockGames = [mockGame];
      mockPrismaService.game.findMany.mockResolvedValue(mockGames);
      mockPrismaService.game.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result).toEqual({
        data: mockGames,
        meta: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
      });
      expect(prisma.game.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              slug: true,
              isLive: true,
            },
          },
        },
        orderBy: [
          { isFeatured: 'desc' },
          { isHot: 'desc' },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: 0,
        take: 50,
      });
    });

    it('should filter games by provider', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAll({ provider: 'pragmatic-play' });

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: {
              slug: 'pragmatic-play',
            },
          }),
        })
      );
    });

    it('should filter games by category', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAll({ category: GameCategory.SLOTS });

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: GameCategory.SLOTS,
          }),
        })
      );
    });

    it('should filter games by isHot flag', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAll({ isHot: true });

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isHot: true,
          }),
        })
      );
    });

    it('should filter games by isNew flag', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAll({ isNew: true });

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isNew: true,
          }),
        })
      );
    });

    it('should filter games by isFeatured flag', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAll({ isFeatured: true });

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isFeatured: true,
          }),
        })
      );
    });

    it('should search games by name', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAll({ search: 'bonanza' });

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: {
              contains: 'bonanza',
              mode: 'insensitive',
            },
          }),
        })
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(100);

      const result = await service.findAll({}, { page: 2, limit: 20 });

      expect(result.meta).toEqual({
        total: 100,
        page: 2,
        limit: 20,
        totalPages: 5,
      });
      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });

    it('should combine multiple filters', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([mockGame]);
      mockPrismaService.game.count.mockResolvedValue(1);

      await service.findAll({
        provider: 'pragmatic-play',
        category: GameCategory.SLOTS,
        isHot: true,
        search: 'bonanza',
      });

      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            provider: { slug: 'pragmatic-play' },
            category: GameCategory.SLOTS,
            isHot: true,
            name: { contains: 'bonanza', mode: 'insensitive' },
          },
        })
      );
    });
  });

  describe('findBySlug', () => {
    it('should return a game by slug', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);

      const result = await service.findBySlug('sweet-bonanza');

      expect(result).toEqual(mockGame);
      expect(prisma.game.findUnique).toHaveBeenCalledWith({
        where: { slug: 'sweet-bonanza' },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              slug: true,
              isLive: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if game not found', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        'Game with slug "non-existent" not found'
      );
    });
  });

  describe('findAllProviders', () => {
    it('should return all active providers with game counts', async () => {
      const mockProviders = [
        {
          id: 'provider-1',
          name: 'Pragmatic Play',
          slug: 'pragmatic-play',
          isLive: true,
          _count: { games: 50 },
        },
      ];
      mockPrismaService.gameProvider.findMany.mockResolvedValue(mockProviders);

      const result = await service.findAllProviders();

      expect(result).toEqual(mockProviders);
      expect(prisma.gameProvider.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          isLive: true,
          _count: {
            select: {
              games: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getCategories', () => {
    it('should return categories with game counts', async () => {
      const mockCategories = [
        { category: GameCategory.SLOTS, _count: { category: 100 } },
        { category: GameCategory.CRASH, _count: { category: 2 } },
      ];
      mockPrismaService.game.groupBy.mockResolvedValue(mockCategories);

      const result = await service.getCategories();

      expect(result).toEqual([
        { category: GameCategory.SLOTS, count: 100 },
        { category: GameCategory.CRASH, count: 2 },
      ]);
      expect(prisma.game.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        where: { isActive: true },
        _count: {
          category: true,
        },
      });
    });
  });

  describe('launchGame', () => {
    it('should launch external game and create session', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.gameSession.create.mockResolvedValue(mockSession);

      const result = await service.launchGame('sweet-bonanza', {
        userId: 'user-1',
        currency: 'USDT',
      });

      expect(result).toMatchObject({
        sessionId: 'session-1',
        type: 'external',
        game: {
          id: 'game-1',
          name: 'Sweet Bonanza',
          slug: 'sweet-bonanza',
          category: GameCategory.SLOTS,
          provider: 'Pragmatic Play',
        },
      });
      expect(result.url).toContain('mock-provider.com');
      expect(prisma.gameSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          gameId: 'game-1',
          currency: 'USDT',
          status: SessionStatus.ACTIVE,
          totalBet: 0,
          totalWin: 0,
        }),
      });
    });

    it('should launch internal game with internal URL', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(mockInternalGame);
      mockPrismaService.gameSession.create.mockResolvedValue({
        ...mockSession,
        gameId: 'game-2',
      });

      const result = await service.launchGame('crash', {
        userId: 'user-1',
      });

      expect(result).toMatchObject({
        sessionId: 'session-1',
        url: '/games/crash',
        type: 'internal',
        game: {
          id: 'game-2',
          name: 'Crash',
          slug: 'crash',
        },
      });
    });

    it('should use default currency if not provided', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(mockGame);
      mockPrismaService.gameSession.create.mockResolvedValue(mockSession);

      await service.launchGame('sweet-bonanza', { userId: 'user-1' });

      expect(prisma.gameSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: 'USDT',
        }),
      });
    });

    it('should throw NotFoundException if game is not active', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue({
        ...mockGame,
        isActive: false,
      });

      await expect(
        service.launchGame('sweet-bonanza', { userId: 'user-1' })
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.launchGame('sweet-bonanza', { userId: 'user-1' })
      ).rejects.toThrow('Game "Sweet Bonanza" is not available');
    });

    it('should throw NotFoundException if game not found', async () => {
      mockPrismaService.game.findUnique.mockResolvedValue(null);

      await expect(
        service.launchGame('non-existent', { userId: 'user-1' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('closeSession', () => {
    it('should close an active session', async () => {
      mockPrismaService.gameSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.gameSession.update.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.COMPLETED,
        endedAt: new Date(),
      });

      const result = await service.closeSession('session-1');

      expect(result.message).toBe('Session closed successfully');
      expect(result.session.status).toBe(SessionStatus.COMPLETED);
      expect(prisma.gameSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          status: SessionStatus.COMPLETED,
          endedAt: expect.any(Date),
        },
      });
    });

    it('should return message if session already closed', async () => {
      mockPrismaService.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.COMPLETED,
      });

      const result = await service.closeSession('session-1');

      expect(result.message).toBe('Session already closed');
      expect(prisma.gameSession.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if session not found', async () => {
      mockPrismaService.gameSession.findUnique.mockResolvedValue(null);

      await expect(service.closeSession('non-existent')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.closeSession('non-existent')).rejects.toThrow(
        'Session "non-existent" not found'
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return user active sessions', async () => {
      const mockSessions = [
        {
          ...mockSession,
          game: {
            id: 'game-1',
            name: 'Sweet Bonanza',
            slug: 'sweet-bonanza',
            thumbnail: 'https://example.com/sweet-bonanza.jpg',
          },
        },
      ];
      mockPrismaService.gameSession.findMany.mockResolvedValue(mockSessions);

      const result = await service.getUserSessions('user-1');

      expect(result).toEqual(mockSessions);
      expect(prisma.gameSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: SessionStatus.ACTIVE,
        },
        include: {
          game: {
            select: {
              id: true,
              name: true,
              slug: true,
              thumbnail: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('updateSessionTotals', () => {
    it('should update session bet and win totals', async () => {
      mockPrismaService.gameSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.gameSession.update.mockResolvedValue({
        ...mockSession,
        totalBet: 100,
        totalWin: 150,
      });

      const result = await service.updateSessionTotals('session-1', 100, 150);

      expect(result.totalBet).toBe(100);
      expect(result.totalWin).toBe(150);
      expect(prisma.gameSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          totalBet: { increment: 100 },
          totalWin: { increment: 150 },
        },
      });
    });

    it('should throw NotFoundException if session not found', async () => {
      mockPrismaService.gameSession.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSessionTotals('non-existent', 100, 150)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateSessionTotals('non-existent', 100, 150)
      ).rejects.toThrow('Session "non-existent" not found');
    });
  });
});
