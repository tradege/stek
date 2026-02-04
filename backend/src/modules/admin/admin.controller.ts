import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GameConfigService } from '../crash/game-config.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly gameConfigService: GameConfigService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('stats/real')
  async getRealStats() {
    return this.adminService.getRealStats();
  }

  @Get('game/config')
  async getGameConfig() {
    return this.gameConfigService.getConfig();
  }

  @Post('game/config')
  async updateGameConfig(@Body() config: any) {
    return this.gameConfigService.updateConfig(config);
  }

  @Get('users')
  async getUsers(@Query('limit') limit?: string) {
    return this.adminService.getAllUsers(limit ? parseInt(limit) : 100);
  }

  @Get('users/pending')
  async getPendingUsers() {
    return this.adminService.getPendingUsers();
  }

  @Post('users/:id/approve')
  async approveUser(@Param('id') userId: string, @Request() req: any) {
    return this.adminService.approveUser(userId, req.user.id);
  }

  @Post('users/:id/send-verification')
  async sendVerification(@Param('id') userId: string, @Request() req: any) {
    return this.adminService.sendVerificationEmail(userId, req.user.id);
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') userId: string, @Request() req: any) {
    return this.adminService.banUser(userId, req.user.id);
  }

  @Post('users/:id/unban')
  async unbanUser(@Param('id') userId: string, @Request() req: any) {
    return this.adminService.unbanUser(userId, req.user.id);
  }

  @Get('transactions')
  async getTransactions(@Query('limit') limit?: string) {
    return this.adminService.getTransactions(limit ? parseInt(limit) : 100);
  }
}
