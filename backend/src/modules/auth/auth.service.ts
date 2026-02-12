import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';
import { User, UserRole, UserStatus, Currency } from '@prisma/client';

// DTOs
export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  referralCode?: string;
  siteId?: string; // Multi-tenant: which brand the user registers on
}

export interface LoginDto {
  email: string;
  password: string;
  siteId?: string; // Multi-tenant: which brand the user logs into
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
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

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Register a new user - TENANT AWARE
   * User is bound to the siteId from the request
   */
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

    // Check if user already exists (SCOPED to siteId for username, global for email)
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

    // Create user with transaction (user + wallet) - TENANT SCOPED
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          passwordHash,
          role: UserRole.USER,
          status: UserStatus.PENDING_APPROVAL,
          parentId,
          hierarchyPath,
          hierarchyLevel,
          displayName: username,
          siteId: effectiveSiteId, // *** MULTI-TENANT BINDING ***
        },
      });

      // Create initial wallet - ALSO bound to siteId
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          currency: Currency.USDT,
          balance: 0,
          lockedBalance: 0,
          siteId: effectiveSiteId, // *** MULTI-TENANT BINDING ***
        },
      });

      return newUser;
    });

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Login user - TENANT AWARE
   * Validates that user belongs to the requesting site
   */
  async login(dto: LoginDto, siteId?: string): Promise<AuthResponse> {
    const { email, password } = dto;
    const effectiveSiteId = dto.siteId || siteId || null;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    // Find user by email - ADMIN can login from any site
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // MULTI-TENANT CHECK: Non-admin users must belong to the requesting site
    if (user.role !== UserRole.ADMIN && effectiveSiteId && user.siteId && user.siteId !== effectiveSiteId) {
      throw new UnauthorizedException('Invalid credentials'); // Don't reveal cross-site info
    }

    // Check if user is active
    if (user.status === UserStatus.PENDING_APPROVAL) {
      throw new UnauthorizedException('Your account is waiting for administrator approval. Please wait.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    // Verify password (support both argon2 and bcrypt)
    let isPasswordValid = false;
    if (user.passwordHash.startsWith('$argon2')) {
      isPasswordValid = await argon2.verify(user.passwordHash, password);
    } else {
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    }
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Get current user with balance - TENANT SCOPED wallets
   */
  async getMe(userId: string): Promise<UserWithBalance> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: {
          where: { siteId: undefined }, // Get wallets matching user's site
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Filter wallets to only show those matching user's siteId
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

      if (!user || user.status !== UserStatus.ACTIVE) {
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
      siteId: user.siteId, // *** MULTI-TENANT: Include in JWT ***
      tokenVersion: user.tokenVersion ?? 0, // For token revocation on password change
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

    // Verify current password
    let isPasswordValid = false;
    if (user.passwordHash.startsWith('$argon2')) {
      isPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
    } else {
      isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    }
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password with argon2
    const newHash = await argon2.hash(newPassword);

    // Update password AND increment tokenVersion to invalidate all existing tokens
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        tokenVersion: { increment: 1 }, // This kills all zombie tokens!
      },
    });

    return { message: 'Password changed successfully. All sessions have been invalidated.' };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
