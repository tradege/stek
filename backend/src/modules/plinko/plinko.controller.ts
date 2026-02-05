import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsNumber, IsEnum, Min, Max, IsNotEmpty } from 'class-validator';
import { PlinkoService } from './plinko.service';
import { RiskLevel } from './plinko.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// DTO with proper validation decorators
class PlayPlinkoDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  betAmount: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(8)
  @Max(16)
  rows: number;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  @IsNotEmpty()
  risk: RiskLevel;
}

// Export PlinkoResult interface for TypeScript
export interface PlinkoResult {
  path: number[];
  bucketIndex: number;
  multiplier: number;
  payout: number;
  profit: number;
}

@Controller('games/plinko')
export class PlinkoController {
  constructor(private readonly plinkoService: PlinkoService) {}

  @Post('play')
  @UseGuards(JwtAuthGuard)
  async play(@Request() req, @Body() dto: PlayPlinkoDto): Promise<PlinkoResult> {
    // Pass DTO object to service (service expects dto object, not separate params)
    const result = await this.plinkoService.play(req.user.id, dto);
    return result;
  }

  @Get('multipliers')
  getMultipliers(
    @Query('rows') rows: string,
    @Query('risk') risk: RiskLevel,
  ) {
    return {
      multipliers: this.plinkoService.getMultipliers(parseInt(rows), risk),
    };
  }
}
