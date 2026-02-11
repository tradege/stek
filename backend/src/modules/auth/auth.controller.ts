import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService, RegisterDto, LoginDto, AuthResponse, UserWithBalance } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Create a new user account - TENANT AWARE
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Request() req): Promise<AuthResponse> {
    const siteId = req.tenant?.siteId || null;
    return this.authService.register(dto, siteId);
  }

  /**
   * POST /auth/login
   * Authenticate user - TENANT AWARE
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Request() req): Promise<AuthResponse> {
    const siteId = req.tenant?.siteId || null;
    return this.authService.login(dto, siteId);
  }

  /**
   * GET /auth/me
   * Get current authenticated user with balance
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req): Promise<UserWithBalance> {
    return this.authService.getMe(req.user.id);
  }

  /**
   * POST /auth/logout
   * Logout is handled client-side (remove JWT)
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'Logged out successfully' };
  }
}
