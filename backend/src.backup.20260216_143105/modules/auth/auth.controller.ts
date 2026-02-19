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
  Put,
  Req,
  Query,
  Delete,
  Param,
} from '@nestjs/common';
import { AuthService, RegisterDto, LoginDto, AuthResponse, UserWithBalance } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Request() req): Promise<AuthResponse> {
    const siteId = req.tenant?.siteId || null;
    return this.authService.register(dto, siteId);
  }

  /**
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Request() req): Promise<AuthResponse> {
    const siteId = req.tenant?.siteId || null;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, siteId, ip, userAgent);
  }

  /**
   * GET /auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req): Promise<UserWithBalance> {
    return this.authService.getMe(req.user.id);
  }

  /**
   * POST /auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  // ============================================
  // ADD-1: EMAIL VERIFICATION
  // ============================================

  /**
   * GET /auth/verify-email?token=xxx
   */
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    if (!token) {
      return { success: false, message: 'Token is required' };
    }
    return this.authService.verifyEmail(token);
  }

  /**
   * POST /auth/resend-verification
   */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerificationEmail(body.email);
  }

  // ============================================
  // TASK 40-2: PASSWORD RESET
  // ============================================

  /**
   * POST /auth/forgot-password
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  /**
   * POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  // ============================================
  // ADD-2: TWO-FACTOR AUTHENTICATION
  // ============================================

  /**
   * POST /auth/2fa/enable - Generate QR code for 2FA setup
   */
  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable2FA(@Request() req) {
    return this.authService.enable2FA(req.user.id);
  }

  /**
   * POST /auth/2fa/verify - Verify TOTP code to complete 2FA setup
   */
  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verify2FA(@Request() req, @Body() body: { code: string }) {
    return this.authService.verify2FA(req.user.id, body.code);
  }

  /**
   * POST /auth/2fa/disable - Disable 2FA (requires current TOTP code)
   */
  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable2FA(@Request() req, @Body() body: { code: string }) {
    return this.authService.disable2FA(req.user.id, body.code);
  }

  // ============================================
  // ADD-3: SESSION MANAGEMENT
  // ============================================

  /**
   * GET /auth/sessions - Get active sessions
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Request() req) {
    return this.authService.getActiveSessions(req.user.id);
  }

  /**
   * DELETE /auth/sessions/:id - Revoke a specific session
   */
  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@Request() req, @Param('id') sessionId: string) {
    return this.authService.revokeSession(req.user.id, sessionId);
  }

  /**
   * Post /auth/sessions/revoke-all - Revoke all sessions except current
   */
  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(@Request() req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return this.authService.revokeAllSessions(req.user.id, token);
  }
}
