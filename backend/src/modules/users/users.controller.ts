import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('platform-stats')
  async getPlatformStats() {
    return this.usersService.getPlatformStats();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getMyStats(@Request() req: any) {
    return this.usersService.getUserStats(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req: any) {
    return this.usersService.getUserProfile(req.user.id);
  }

  @Get('bets')
  @UseGuards(JwtAuthGuard)
  async getMyBets(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('gameType') gameType?: string,
  ) {
    return this.usersService.getUserBets(
      req.user.id,
      parseInt(page || '1'),
      parseInt(limit || '20'),
      gameType,
    );
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getMyTransactions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.usersService.getUserTransactions(
      req.user.id,
      parseInt(page || '1'),
      parseInt(limit || '20'),
      type,
    );
  }

  @Get('financial-summary')
  @UseGuards(JwtAuthGuard)
  async getMyFinancialSummary(@Request() req: any) {
    return this.usersService.getUserFinancialSummary(req.user.id);
  }
}
