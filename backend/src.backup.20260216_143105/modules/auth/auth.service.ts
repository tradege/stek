import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';
import { User, UserRole, UserStatus, Currency } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

// DTOs
export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  referralCode?: string;
  siteId?: string;
}

export interface LoginDto {
  email: string;
  password: string;
  totpCode?: string;
  siteId?: string;
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
  requiresTwoFactor?: boolean;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  vipLevel: number;
  totalWagered: string;
  xp: number;
  siteId: string | null;
  twoFactorEnabled?: boolean;
}

export interface UserWithBalance extends SafeUser {
  balance: {
    currency: Currency;
    available: string;
    locked: string;
  }[];
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ============================================
  // REGISTRATION (with Email Verification - ADD-1)
  // ============================================

  async register(dto: RegisterDto, siteId?: string): Promise<AuthResponse> {
    const { username, email, password, referralCode } = dto;
    const effectiveSiteId = dto.siteId || siteId || null;

    // Validate input
    if (!username || username.length < 3 || username.length > 20) {
      throw new BadRequestException('Username must be 3-20 characters');
    }
    if (!email || !this.isValidEmail(email)) {
      throw new BadRequestException('Invalid email address');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase(), siteId: effectiveSiteId },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Find parent user if referral code provided
    let parentId: string | null = null;
    let hierarchyPath = '/';
    let hierarchyLevel = 4;

    if (referralCode) {
      const parentUser = await this.prisma.user.findUnique({
        where: { id: referralCode },
      });
      if (parentUser) {
        parentId = parentUser.id;
        hierarchyPath = `${parentUser.hierarchyPath}${parentUser.id}/`;
        hierarchyLevel = Math.min(parentUser.hierarchyLevel + 1, 4);
      }
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user with PENDING_VERIFICATION status (ADD-1)
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          passwordHash,
          role: UserRole.USER,
          status: UserStatus.PENDING_VERIFICATION,
          parentId,
          hierarchyPath,
          hierarchyLevel,
          displayName: username,
          siteId: effectiveSiteId,
        },
      });

      // Create initial wallet
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          currency: Currency.USDT,
          balance: 0,
          lockedBalance: 0,
          siteId: effectiveSiteId,
        },
      });

      return newUser;
    });

    // Generate email verification token (ADD-1)
    const verificationToken = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    this.logger.log(`[EMAIL VERIFICATION] User ${user.email} - Token: ${verificationToken}`);
    this.logger.log(`[EMAIL VERIFICATION] Verify URL: /auth/verify-email?token=${verificationToken}`);

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  // ============================================
  // ADD-1: EMAIL VERIFICATION
  // ============================================

  async verifyEmail(verificationToken: string): Promise<{ success: boolean; message: string }> {
    const tokenRecord = await this.prisma.emailVerificationToken.findUnique({
      where: { token: verificationToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid verification token');
    }

    if (tokenRecord.used) {
      throw new BadRequestException('Token has already been used');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Activate user and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { status: UserStatus.ACTIVE },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      }),
    ]);

    this.logger.log(`[EMAIL VERIFIED] User ${tokenRecord.user.email} is now ACTIVE`);

    return {
      success: true,
      message: 'Email verified successfully. Your account is now active.',
    };
  }

  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return { success: true, message: 'If the email exists, a verification link has been sent.' };
    }

    if (user.status === UserStatus.ACTIVE) {
      return { success: true, message: 'Email is already verified.' };
    }

    const verificationToken = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    this.logger.log(`[EMAIL VERIFICATION RESEND] User ${user.email} - Token: ${verificationToken}`);

    return { success: true, message: 'If the email exists, a verification link has been sent.' };
  }

  // ============================================
  // LOGIN (with 2FA support - ADD-2)
  // ============================================

  async login(dto: LoginDto, siteId?: string, ip?: string, userAgent?: string): Promise<AuthResponse> {
    const { email, password, totpCode } = dto;
    const effectiveSiteId = dto.siteId || siteId || null;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // MULTI-TENANT CHECK
    if (user.role !== UserRole.ADMIN && effectiveSiteId && user.siteId && user.siteId !== effectiveSiteId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active or pending verification
    if (user.status === UserStatus.PENDING_APPROVAL) {
      throw new UnauthorizedException('Your account is waiting for administrator approval. Please wait.');
    }
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException('Please verify your email address before logging in. Check your inbox.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    // Verify password
    let isPasswordValid = false;
    if (user.passwordHash.startsWith('$argon2')) {
      isPasswordValid = await argon2.verify(user.passwordHash, password);
    } else {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // ADD-2: 2FA Check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        // Return a signal that 2FA is required
        return {
          user: this.sanitizeUser(user),
          token: '',
          requiresTwoFactor: true,
        };
      }

      const isValidTotp = authenticator.verify({
        token: totpCode,
        secret: user.twoFactorSecret,
      });

      if (!isValidTotp) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip || null,
      },
    });

    const token = this.generateToken(user);

    // ADD-3: Create session record
    try {
      await this.prisma.userSession.create({
        data: {
          userId: user.id,
          token: createHash('sha256').update(token).digest('hex'),
          ipAddress: ip || 'unknown',
          userAgent: userAgent || 'unknown',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to create session record: ${e.message}`);
    }

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  // ============================================
  // TASK 40-2: PASSWORD RESET FLOW
  // ============================================

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true, message: 'If the email exists, a reset link has been sent.' };
    }

    // Generate secure token
    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // Log token to console (no SMTP yet)
    this.logger.log(`[PASSWORD RESET] User ${user.email} - Token: ${resetToken}`);
    this.logger.log(`[PASSWORD RESET] Reset URL: /reset-password?token=${resetToken}`);

    return {
      success: true,
      message: 'If the email exists, a reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (tokenRecord.used) {
      throw new BadRequestException('This reset token has already been used');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await argon2.hash(newPassword);

    // Update password and invalidate all tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      }),
      // Invalidate all sessions
      this.prisma.userSession.deleteMany({
        where: { userId: tokenRecord.userId },
      }),
    ]);

    this.logger.log(`[PASSWORD RESET] Password reset successful for user ${tokenRecord.userId}`);

    return {
      success: true,
      message: 'Password has been reset successfully. Please login with your new password.',
    };
  }

  // ============================================
  // ADD-2: TWO-FACTOR AUTHENTICATION (TOTP)
  // ============================================

  async enable2FA(userId: string): Promise<{ secret: string; qrCodeUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'StakePro Casino', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not enabled yet until verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, qrCodeUrl, otpauthUrl };
  }

  async verify2FA(userId: string, totpCode: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorSecret) throw new BadRequestException('2FA setup not initiated');

    const isValid = authenticator.verify({
      token: totpCode,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid 2FA code. Please try again.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { success: true, message: '2FA has been enabled successfully.' };
  }

  async disable2FA(userId: string, totpCode: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorEnabled) throw new BadRequestException('2FA is not enabled');

    const isValid = authenticator.verify({
      token: totpCode,
      secret: user.twoFactorSecret!,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid 2FA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { success: true, message: '2FA has been disabled.' };
  }

  // ============================================
  // ADD-3: SESSION MANAGEMENT
  // ============================================

  async getActiveSessions(userId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map(s => ({
      ...s,
      device: this.parseUserAgent(s.userAgent || ''),
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ success: boolean; message: string }> {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.userSession.delete({
      where: { id: sessionId },
    });

    return { success: true, message: 'Session revoked successfully.' };
  }

  async revokeAllSessions(userId: string, exceptCurrent?: string): Promise<{ success: boolean; message: string; count: number }> {
    const where: any = { userId };
    if (exceptCurrent) {
      where.NOT = { token: createHash('sha256').update(exceptCurrent).digest('hex') };
    }

    const result = await this.prisma.userSession.deleteMany({ where });

    return {
      success: true,
      message: `${result.count} session(s) revoked.`,
      count: result.count,
    };
  }

  private parseUserAgent(ua: string): string {
    if (ua.includes('Chrome')) return 'Chrome Browser';
    if (ua.includes('Firefox')) return 'Firefox Browser';
    if (ua.includes('Safari')) return 'Safari Browser';
    if (ua.includes('Edge')) return 'Edge Browser';
    if (ua.includes('Mobile')) return 'Mobile Device';
    return ua.substring(0, 50) || 'Unknown Device';
  }

  // ============================================
  // EXISTING: Get current user with balance
  // ============================================

  async getMe(userId: string): Promise<UserWithBalance> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: {
          where: { siteId: undefined },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const filteredWallets = user.wallets.filter(
      w => !user.siteId || !w.siteId || w.siteId === user.siteId
    );

    return {
      ...this.sanitizeUser(user),
      balance: filteredWallets.map((wallet) => ({
        currency: wallet.currency,
        available: wallet.balance.toString(),
        locked: wallet.lockedBalance.toString(),
      })),
    };
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<SafeUser | null> {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING_VERIFICATION)) {
        return null;
      }

      return this.sanitizeUser(user);
    } catch {
      return null;
    }
  }

  /**
   * Generate JWT token - includes siteId
   */
  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      tokenVersion: user.tokenVersion ?? 0,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: User): SafeUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      vipLevel: user.vipLevel,
      totalWagered: user.totalWagered.toString(),
      xp: user.xp,
      siteId: user.siteId,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  /**
   * Change user password and invalidate all existing tokens
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let isPasswordValid = false;
    if (user.passwordHash.startsWith('$argon2')) {
      isPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
    } else {
      isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    }
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.userSession.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Password changed successfully. All sessions have been invalidated.' };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
