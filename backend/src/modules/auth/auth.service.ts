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
  referralCode?: string; // Optional parent referral
}

export interface LoginDto {
  email: string;
  password: string;
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
   * Register a new user
   * Creates user account + initial wallet with $0.00
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const { username, email, password, referralCode } = dto;

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
          { username: username.toLowerCase() },
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
    let hierarchyLevel = 4; // Default USER level

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

    // Create user with transaction (user + wallet)
    const user = await this.prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          passwordHash,
          role: UserRole.USER,
          status: UserStatus.ACTIVE, // Auto-activate for now
          parentId,
          hierarchyPath,
          hierarchyLevel,
          displayName: username,
        },
      });

      // Create initial wallet with $0.00 (USDT as default)
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          currency: Currency.USDT,
          balance: 0,
          lockedBalance: 0,
        },
      });

      return newUser;
    });

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Login user with email and password
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const { email, password } = dto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);
    }

    // Verify password (support both argon2 and bcrypt)
    let isPasswordValid = false;
    
    if (user.passwordHash.startsWith('$argon2')) {
      // Argon2 hash
      isPasswordValid = await argon2.verify(user.passwordHash, password);
    } else {
      // Bcrypt hash
      isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    }
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Get current user with balance
   */
  async getMe(userId: string): Promise<UserWithBalance> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      ...this.sanitizeUser(user),
      balance: user.wallets.map((wallet) => ({
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
   * Generate JWT token for user
   */
  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
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
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
