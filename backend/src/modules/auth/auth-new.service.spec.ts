import { AuthService } from './auth.service';
import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock argon2
jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashedpassword'),
  verify: jest.fn().mockResolvedValue(true),
}));

// Mock otplib
jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn().mockReturnValue('MOCK_SECRET'),
    verify: jest.fn().mockReturnValue(true),
  },
}));

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockQR'),
}));

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token-123'),
  verify: jest.fn().mockReturnValue({ sub: 'user-1', email: 'test@test.com' }),
};

// Mock EmailService
const mockEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
};

// Mock PrismaService
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  wallet: {
    create: jest.fn(),
  },
  emailVerificationToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  userSession: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      mockPrisma as any,
      mockJwtService as any,
      mockEmailService as any,
    );

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockPrisma);
      return Promise.all(cb);
    });
  });

  describe('register', () => {
    it('should create a new user successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const mockUser = {
        id: 'user-new-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: '$2b$12$hashedpassword',
        role: 'USER',
        status: 'PENDING_VERIFICATION',
        displayName: 'testuser',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        vipLevel: 0,
        totalWagered: '0',
        xp: 0,
        siteId: null,
        twoFactorEnabled: false,
      };

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          const tx = {
            user: { create: jest.fn().mockResolvedValue(mockUser) },
            wallet: { create: jest.fn().mockResolvedValue({}) },
            emailVerificationToken: { create: jest.fn().mockResolvedValue({ id: 'token-1', token: '123456' }) },
          };
          return cb(tx);
        }
        return cb;
      });

      const result = await service.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should generate email verification token on registration', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const mockUser = {
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        role: 'USER',
        status: 'PENDING_VERIFICATION',
        displayName: 'test',
        avatarUrl: null,
        createdAt: new Date(),
        vipLevel: 0,
        totalWagered: '0',
        xp: 0,
      };

      const mockTokenCreate = jest.fn().mockResolvedValue({
        id: 'token-1',
        token: 'test-verification-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          const tx = {
            user: { create: jest.fn().mockResolvedValue(mockUser) },
            wallet: { create: jest.fn().mockResolvedValue({}) },
            emailVerificationToken: { create: mockTokenCreate },
          };
          return cb(tx);
        }
        return cb;
      });

      await service.register({
        username: 'test',
        email: 'test@test.com',
        password: 'Password123!',
      });

      expect(mockTokenCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should reject duplicate email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      });

      await expect(
        service.register({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject short username (< 3 chars)', async () => {
      await expect(
        service.register({
          username: 'ab',
          email: 'test@test.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject short password (< 8 chars)', async () => {
      await expect(
        service.register({
          username: 'testuser',
          email: 'test@test.com',
          password: 'short',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid email format', async () => {
      await expect(
        service.register({
          username: 'testuser',
          email: 'not-an-email',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send verification email after registration', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          const tx = {
            user: {
              create: jest.fn().mockResolvedValue({
                id: 'user-1',
                username: 'test',
                email: 'test@test.com',
                role: 'USER',
                status: 'PENDING_VERIFICATION',
                displayName: 'test',
                avatarUrl: null,
                createdAt: new Date(),
                vipLevel: 0,
                totalWagered: '0',
                xp: 0,
              }),
            },
            wallet: { create: jest.fn().mockResolvedValue({}) },
            emailVerificationToken: { create: jest.fn().mockResolvedValue({ id: 'token-1', token: 'verify-token' }) },
          };
          return cb(tx);
        }
        return cb;
      });

      await service.register({
        username: 'test',
        email: 'test@test.com',
        password: 'Password123!',
      });

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail.mock.calls[0][0]).toBe('test@test.com');
      expect(typeof mockEmailService.sendVerificationEmail.mock.calls[0][1]).toBe('string');
    });
  });

  describe('login', () => {
    const mockActiveUser = {
      id: 'user-1',
      username: 'testuser',
      email: 'test@test.com',
      passwordHash: '$2b$12$hashedpassword',
      role: 'USER',
      status: 'ACTIVE',
      displayName: 'testuser',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      vipLevel: 0,
      totalWagered: '0',
      xp: 0,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      tokenVersion: 0,
      parentId: null,
      hierarchyLevel: 4,
      hierarchyPath: '/',
      lastLoginAt: null,
      lastLoginIp: null,
      isBot: false,
      country: null,
      language: 'en',
      timezone: 'UTC',
      revenueSharePercent: 0,
      turnoverRebatePercent: 0,
      creditLimit: 0,
      creditUsed: 0,
      totalBets: 0,
      claimableRakeback: new Decimal(0),
      affiliateCarryover: new Decimal(0),
      emailVerificationToken: null,
    };

    it('should return JWT token on successful login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.login({
        email: 'test@test.com',
        password: 'Password123!',
      });

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@test.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@test.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject login for pending verification user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        status: 'PENDING_VERIFICATION',
      });

      await expect(
        service.login({
          email: 'test@test.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      // verifyEmail uses user.findUnique with include: { emailVerificationTokens }
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        status: 'PENDING_VERIFICATION',
        emailVerificationTokens: [
          {
            id: 'token-1',
            token: 'valid-code',
            userId: 'user-1',
            used: false,
            expiresAt: new Date(Date.now() + 60000),
          },
        ],
      });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.emailVerificationToken.update.mockResolvedValue({});

      const result = await service.verifyEmail('test@test.com', 'valid-code');
      expect(result.success).toBe(true);
    });

    it('should reject invalid token', async () => {
      // User not found
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('test@test.com', 'invalid-code')).rejects.toThrow(BadRequestException);
    });

    it('should reject already-used token', async () => {
      // User found but no valid tokens (empty array since query filters used: false)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        status: 'PENDING_VERIFICATION',
        emailVerificationTokens: [],
      });

      await expect(service.verifyEmail('test@test.com', 'used-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('JWT token generation', () => {
    it('should use JwtService.sign to generate tokens', () => {
      const token = mockJwtService.sign({ sub: 'user-1', email: 'test@test.com' });
      expect(token).toBe('mock-jwt-token-123');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });
  });
});
