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
import { PlinkoService, RiskLevel } from './plinko.service';
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

@Controller('games/plinko')
export class PlinkoController {
  constructor(private readonly plinkoService: PlinkoService) {}

  @Post('play')
  @UseGuards(JwtAuthGuard)
  async play(@Request() req, @Body() dto: PlayPlinkoDto) {
    const result = await this.plinkoService.play(
      req.user.id,
      dto.betAmount,
      dto.rows,
      dto.risk,
    );
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
