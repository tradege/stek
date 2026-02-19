import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { GamesService, GameFilters, PaginationOptions } from './games.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GameCategory } from '@prisma/client';

// DTOs with validation decorators
class GetGamesQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsEnum(GameCategory)
  category?: GameCategory;

  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  isHot?: string;

  @IsOptional()
  @IsString()
  isNew?: string;

  @IsOptional()
  @IsString()
  isFeatured?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

class LaunchGameDto {
  @IsOptional()
  @IsString()
  currency?: string;
}

@Controller('api/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  /**
   * GET /api/games
   * List all active games with filtering and pagination
   */
  @Get()
  async findAll(@Query() query: GetGamesQueryDto) {
    const filters: GameFilters = {
      provider: query.provider,
      category: query.category as GameCategory,
      isActive: query.isActive === 'false' ? false : true,
      isHot: query.isHot === 'true' ? true : undefined,
      isNew: query.isNew === 'true' ? true : undefined,
      isFeatured: query.isFeatured === 'true' ? true : undefined,
      search: query.search,
    };

    const pagination: PaginationOptions = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
    };

    return this.gamesService.findAll(filters, pagination);
  }

  /**
   * GET /api/games/providers
   * List all active providers
   */
  @Get('providers')
  async getProviders() {
    return this.gamesService.findAllProviders();
  }

  /**
   * GET /api/games/categories
   * List all categories with game counts
   */
  @Get('categories')
  async getCategories() {
    return this.gamesService.getCategories();
  }

  /**
   * GET /api/games/sessions/active
   * Get user's active sessions (protected)
   * NOTE: This route must be before :slug to avoid conflict
   */
  @Get('sessions/active')
  @UseGuards(JwtAuthGuard)
  async getActiveSessions(@Request() req: any) {
    return this.gamesService.getUserSessions(req.user.id);
  }

  /**
   * GET /api/games/:slug
   * Get single game details by slug
   */
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.gamesService.findBySlug(slug);
  }

  /**
   * POST /api/games/:slug/launch
   * Launch a game (protected - requires authentication)
   * Creates a session and returns the launch URL
   */
  @Post(':slug/launch')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async launchGame(
    @Param('slug') slug: string,
    @Body() dto: LaunchGameDto,
    @Request() req: any
  ) {
    return this.gamesService.launchGame(slug, {
      userId: req.user.id,
      currency: dto.currency,
    });
  }

  /**
   * POST /api/games/sessions/:sessionId/close
   * Close a game session (protected)
   */
  @Post('sessions/:sessionId/close')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async closeSession(@Param('sessionId') sessionId: string) {
    return this.gamesService.closeSession(sessionId);
  }
}
