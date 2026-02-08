import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stats')
  async getMyStats(@Request() req: any) {
    return this.usersService.getUserStats(req.user.id);
  }

  @Get('profile')
  async getMyProfile(@Request() req: any) {
    return this.usersService.getUserProfile(req.user.id);
  }
}
