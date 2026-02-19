import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ProvablyFairService } from './provably-fair.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * FairnessController — Public API for the Provably Fair system.
 * 
 * Endpoints:
 * - GET  /api/fairness/seeds         → Get current seed info (hash + nonce)
 * - POST /api/fairness/rotate-seed   → Rotate server seed (reveal old, create new)
 * - POST /api/fairness/client-seed   → Set a custom client seed
 * - POST /api/fairness/verify        → Verify a past bet with revealed seeds
 */
@Controller('fairness')
export class FairnessController {
  constructor(private readonly fairService: ProvablyFairService) {}

  /**
   * GET /api/fairness/seeds
   * Returns the current active server seed hash and nonce.
   * The actual seed is NEVER exposed until rotation.
   */
  @Get('seeds')
  @UseGuards(JwtAuthGuard)
  async getSeeds(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    const seedInfo = await this.fairService.getOrCreateServerSeed(userId);
    return {
      success: true,
      data: {
        serverSeedHash: seedInfo.seedHash,
        nonce: seedInfo.nonce,
        message: 'The server seed is hidden until you rotate it.',
      },
    };
  }

  /**
   * POST /api/fairness/rotate-seed
   * Rotates the server seed:
   * 1. Reveals the current (old) server seed
   * 2. Creates a new server seed with nonce=0
   * 3. Returns both old seed (revealed) and new seed hash
   * 
   * This allows the player to verify all bets made with the old seed.
   */
  @Post('rotate-seed')
  @UseGuards(JwtAuthGuard)
  async rotateSeed(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    const result = await this.fairService.rotateSeed(userId);
    return {
      success: true,
      data: {
        previousServerSeed: result.previousSeed,
        previousServerSeedHash: result.previousSeedHash,
        previousNonce: result.previousNonce,
        newServerSeedHash: result.newSeedHash,
        message: result.previousSeed
          ? 'Your previous server seed has been revealed. You can now verify all bets made with it. A new server seed has been generated.'
          : 'A new server seed has been created.',
      },
    };
  }

  /**
   * POST /api/fairness/client-seed
   * Allows the player to set a custom client seed.
   * This is stored in the user's session/context and used for future bets.
   */
  @Post('client-seed')
  @UseGuards(JwtAuthGuard)
  async setClientSeed(@Req() req: any, @Body() body: { clientSeed: string }) {
    const { clientSeed } = body;
    if (!clientSeed || clientSeed.length < 1 || clientSeed.length > 64) {
      throw new BadRequestException('Client seed must be between 1 and 64 characters.');
    }
    // Client seed is managed on the frontend (stored in context/localStorage)
    // This endpoint validates and acknowledges the change
    return {
      success: true,
      data: {
        clientSeed,
        message: 'Client seed updated. It will be used for your next bets.',
      },
    };
  }

  /**
   * POST /api/fairness/verify
   * Verify a past bet by providing the revealed server seed, client seed, nonce, and game type.
   * 
   * The server recalculates the result and returns it so the player can compare
   * with the original bet outcome.
   */
  @Post('verify')
  async verify(
    @Body()
    body: {
      serverSeed: string;
      clientSeed: string;
      nonce: number;
      game: string;
      gameParams?: Record<string, any>;
    },
  ) {
    const { serverSeed, clientSeed, nonce, game, gameParams } = body;

    if (!serverSeed || !clientSeed || nonce === undefined || !game) {
      throw new BadRequestException(
        'Missing required fields: serverSeed, clientSeed, nonce, game',
      );
    }

    const validGames = [
      'dice', 'limbo', 'crash', 'mines', 'plinko',
      'card-rush', 'penalty', 'olympus', 'slots',
    ];
    if (!validGames.includes(game)) {
      throw new BadRequestException(
        `Invalid game type. Must be one of: ${validGames.join(', ')}`,
      );
    }

    const result = this.fairService.verify(
      serverSeed,
      clientSeed,
      nonce,
      game,
      gameParams,
    );

    return {
      success: true,
      data: {
        ...result,
        game,
        nonce,
        clientSeed,
        message: 'Verification complete. Compare the result with your bet history.',
      },
    };
  }

  /**
   * GET /api/fairness/info
   * Public endpoint — returns general information about the provably fair system.
   * No authentication required.
   */
  @Get('info')
  async getInfo() {
    return {
      success: true,
      data: {
        algorithm: 'HMAC-SHA256',
        formula: 'HMAC_SHA256(serverSeed, clientSeed:nonce)',
        numberExtraction: 'First 4 bytes of hash → uint32 / 2^32 → float [0, 1)',
        cursorLogic: 'For multi-number games, cursor advances by 4 bytes per number. New hash generated with :round suffix when bytes exhausted.',
        nonceManagement: 'Sequential, starting at 0. Increments by 1 per bet. Stored in database.',
        seedRotation: 'Player can rotate server seed at any time. Old seed is revealed for verification. New seed starts at nonce 0.',
        games: {
          dice: 'float * 10001 / 100 → roll [0.00, 99.99]',
          limbo: 'max(1, floor((1 - houseEdge) / float * 100) / 100) → multiplier',
          crash: 'max(1, floor((1 - houseEdge) / float * 100) / 100) → crash point',
          mines: 'Fisher-Yates shuffle using sequential floats → mine positions',
          plinko: 'float < 0.5 = left, >= 0.5 = right → path through board',
          'card-rush': 'Pairs of floats → suit (4) + rank (13) from infinite deck',
          penalty: '2 floats → goalkeeper position + ball position',
          olympus: 'Multiple floats → reel positions',
          slots: 'Multiple floats → reel positions',
        },
      },
    };
  }
}
