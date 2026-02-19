import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GameCategory, SessionStatus } from '@prisma/client';
import * as crypto from 'crypto';

export interface GameFilters {
  provider?: string;
  category?: GameCategory;
  isActive?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  isFeatured?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface LaunchGameDto {
  userId: string;
  currency?: string;
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all games with filtering and pagination
   */
  async findAll(filters: GameFilters = {}, pagination: PaginationOptions = {}) {
    const { provider, category, isActive = true, isHot, isNew, isFeatured, search } = filters;
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive,
    };

    // Filter by provider slug
    if (provider) {
      where.provider = {
        slug: provider,
      };
    }

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Filter by flags
    if (isHot !== undefined) {
      where.isHot = isHot;
    }
    if (isNew !== undefined) {
      where.isNew = isNew;
    }
    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    // Search by name
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
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
        skip,
        take: limit,
      }),
      this.prisma.game.count({ where }),
    ]);

    return {
      data: games,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single game by slug
   */
  async findBySlug(slug: string) {
    const game = await this.prisma.game.findUnique({
      where: { slug },
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

    if (!game) {
      throw new NotFoundException(`Game with slug "${slug}" not found`);
    }

    return game;
  }

  /**
   * Get all providers
   */
  async findAllProviders() {
    return this.prisma.gameProvider.findMany({
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
  }

  /**
   * Get all categories with game counts
   */
  async getCategories() {
    const categories = await this.prisma.game.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: {
        category: true,
      },
    });

    return categories.map((c) => ({
      category: c.category,
      count: c._count.category,
    }));
  }

  /**
   * Launch a game - create session and return launch URL
   */
  async launchGame(slug: string, dto: LaunchGameDto) {
    const game = await this.findBySlug(slug);

    if (!game.isActive) {
      throw new NotFoundException(`Game "${game.name}" is not available`);
    }

    // Create a new game session
    const sessionId = crypto.randomUUID();
    const session = await this.prisma.gameSession.create({
      data: {
        userId: dto.userId,
        gameId: game.id,
        externalSessionId: sessionId,
        currency: dto.currency || 'USDT',
        status: SessionStatus.ACTIVE,
        totalBet: 0,
        totalWin: 0,
      },
    });

    this.logger.log(
      `Game session created: ${session.id} for user ${dto.userId}, game: ${game.name}`
    );

    // For internal games, return internal URL
    if (game.provider.slug === 'internal') {
      return {
        sessionId: session.id,
        url: `/games/${slug}`,
        type: 'internal',
        game: {
          id: game.id,
          name: game.name,
          slug: game.slug,
          category: game.category,
        },
      };
    }

    // For external games, return mock provider URL
    // In production, this would call the provider's API to get a real launch URL
    const mockLaunchUrl = `https://mock-provider.com/play?token=${sessionId}&game=${game.externalId}&currency=${dto.currency || 'USDT'}`;

    return {
      sessionId: session.id,
      url: mockLaunchUrl,
      type: 'external',
      game: {
        id: game.id,
        name: game.name,
        slug: game.slug,
        category: game.category,
        provider: game.provider.name,
      },
    };
  }

  /**
   * Close a game session
   */
  async closeSession(sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session "${sessionId}" not found`);
    }

    if (session.status !== SessionStatus.ACTIVE) {
      return { message: 'Session already closed', session };
    }

    const updatedSession = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        endedAt: new Date(),
      },
    });

    this.logger.log(`Game session closed: ${sessionId}`);

    return {
      message: 'Session closed successfully',
      session: updatedSession,
    };
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string) {
    return this.prisma.gameSession.findMany({
      where: {
        userId,
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
  }

  /**
   * Update session totals (called by integration service)
   */
  async updateSessionTotals(
    sessionId: string,
    betAmount: number,
    winAmount: number
  ) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session "${sessionId}" not found`);
    }

    return this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        totalBet: { increment: betAmount },
        totalWin: { increment: winAmount },
      },
    });
  }
}
