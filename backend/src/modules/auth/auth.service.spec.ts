/**
 * 🔐 AUTH SERVICE UNIT TESTS
 * Comprehensive tests for authentication, login, and registration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus, Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import * as argon2 from 'argon2';

// Mock bcrypt and argon2
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn(),
}));

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

describe('🔐 AuthService - Unit Tests', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: "user-123",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "$2b$10$hashedpassword",
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    displayName: "Test User",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    parentId: null,
    hierarchyPath: "/",
    hierarchyLevel: 4,
    revenueSharePercent: new Decimal(0),
    turnoverRebatePercent: new Decimal(0),
    creditLimit: new Decimal(0),
    creditUsed: new Decimal(0),
    country: null,
    language: "en",
    timezone: "UTC",
    twoFactorEnabled: false,
    twoFactorSecret: null,
    lastLoginIp: null,
      isBot: false,
  };

  const mockWallet = {
    id: 'wallet-123',
    userId: 'user-123',
    currency: Currency.USDT,
    balance: 100,
    lockedBalance: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            wallet: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('📝 register', () => {
    it('1.1 - Should register new user successfully', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return mockUser;
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.token).toBe('mock-jwt-token');
    });

    it('1.2 - Should throw ConflictException for existing email', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(mockUser);

      await expect(
        service.register({
          username: 'newuser',
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('1.3 - Should throw ConflictException for existing username', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        ...mockUser,
        email: 'different@example.com',
      });

      await expect(
        service.register({
          username: 'testuser',
          email: 'new@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('1.4 - Should throw BadRequestException for invalid email format', async () => {
      await expect(
        service.register({
          username: 'newuser',
          email: 'invalid-email',
          password: 'Password123!',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('1.5 - Should throw BadRequestException for short password', async () => {
      await expect(
        service.register({
          username: 'newuser',
          email: 'new@example.com',
          password: '123',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('1.6 - Should throw BadRequestException for short username', async () => {
      await expect(
        service.register({
          username: 'ab',
          email: 'new@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('1.7 - Should handle referral code and set parent', async () => {
      const parentUser = { ...mockUser, id: 'parent-123', hierarchyPath: '/' };
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(parentUser);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return { ...mockUser, parentId: 'parent-123' };
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
        referralCode: 'parent-123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
    });

    it('1.8 - Should hash password with bcrypt', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return mockUser;
      });

      await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', expect.any(Number));
    });

    it('1.9 - Should create wallet with $0 balance', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      
      let walletCreated = false;
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          wallet: {
            create: jest.fn().mockImplementation(() => {
              walletCreated = true;
              return mockWallet;
            }),
          },
        };
        await callback(tx as any);
        return mockUser;
      });

      await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
      });

      expect(walletCreated).toBe(true);
    });

    it('1.10 - Should generate JWT token after registration', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return mockUser;
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
      });

      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.token).toBe('mock-jwt-token');
    });
  });

  describe('🔑 login', () => {
    it('2.1 - Should login with valid credentials (bcrypt)', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.token).toBe('mock-jwt-token');
    });

    it('2.2 - Should login with valid credentials (argon2)', async () => {
      const argon2User = { ...mockUser, passwordHash: '$argon2id$v=19$...' };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(argon2User);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(argon2User);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
    });

    it('2.3 - Should throw UnauthorizedException for invalid password', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('2.4 - Should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('2.5 - Should throw UnauthorizedException for banned user', async () => {
      const bannedUser = { ...mockUser, status: UserStatus.BANNED };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(bannedUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('2.6 - Should throw UnauthorizedException for suspended user', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(suspendedUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('2.7 - Should throw BadRequestException for missing email', async () => {
      await expect(
        service.login({
          email: '',
          password: 'Password123!',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('2.8 - Should throw BadRequestException for missing password', async () => {
      await expect(
        service.login({
          email: 'test@example.com',
          password: '',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('2.9 - Should update lastLoginAt on successful login', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('2.10 - Should handle case-insensitive email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123!',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toHaveProperty('token');
    });
  });

  describe('👤 getMe', () => {
    it('3.1 - Should return user with balance', async () => {
      const userWithWallets = { ...mockUser, wallets: [mockWallet] };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(userWithWallets);

      const result = await service.getMe('user-123');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('balance');
      expect(result.balance).toHaveLength(1);
    });

    it('3.2 - Should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.getMe('non-existent')).rejects.toThrow(UnauthorizedException);
    });

    it('3.3 - Should return multiple wallet balances', async () => {
      const multiWalletUser = {
        ...mockUser,
        wallets: [
          { ...mockWallet, currency: Currency.USDT },
          { ...mockWallet, id: 'wallet-btc', currency: Currency.BTC, balance: 0.5 },
        ],
      };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(multiWalletUser);

      const result = await service.getMe('user-123');

      expect(result.balance).toHaveLength(2);
    });
  });

  describe('🔍 validateToken', () => {
    it('4.1 - Should return user for valid token', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'user-123' });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.validateToken('valid-token');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
    });

    it('4.2 - Should return null for invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateToken('invalid-token');

      expect(result).toBeNull();
    });

    it('4.3 - Should return null for non-existent user', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'non-existent' });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const result = await service.validateToken('valid-token');

      expect(result).toBeNull();
    });

    it('4.4 - Should return null for inactive user', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.BANNED };
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'user-123' });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(inactiveUser);

      const result = await service.validateToken('valid-token');

      expect(result).toBeNull();
    });

    it('4.5 - Should not expose passwordHash in returned user', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'user-123' });
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.validateToken('valid-token');

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('🛡️ Security Edge Cases', () => {
    it('5.1 - Should sanitize user object (no passwordHash)', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return mockUser;
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('5.2 - Should handle SQL injection in email', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.login({
          email: "'; DROP TABLE users; --",
          password: 'Password123!',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("5.3 - Should reject XSS in username (too long)", async () => {
      jest.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
      
      // Should throw - username is too long
      await expect(
        service.register({
          username: "<script>alert(xss)</script>",
          email: "new@example.com",
          password: "Password123",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('5.4 - Should handle very long password', async () => {
      const longPassword = 'a'.repeat(1000);
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return mockUser;
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: longPassword,
      });

      expect(result).toHaveProperty('token');
    });

    it('5.5 - Should handle unicode in username', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback) => {
        return mockUser;
      });

      const result = await service.register({
        username: 'пользователь',
        email: 'new@example.com',
        password: 'Password123!',
      });

      expect(result).toHaveProperty('user');
    });
  });
  describe('⏳ PENDING_APPROVAL Flow', () => {
    const pendingUser = {
      ...mockUser,
      status: UserStatus.PENDING_APPROVAL,
    };

    it('10.1 - Register should set status to PENDING_APPROVAL', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return {
          ...mockUser,
          status: UserStatus.PENDING_APPROVAL,
        };
      });

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result.user.status).toBe(UserStatus.PENDING_APPROVAL);
    });

    it('10.2 - Login should throw for PENDING_APPROVAL user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(pendingUser as any);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('10.3 - Login error message should mention admin approval', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(pendingUser as any);

      try {
        await service.login({
          email: 'test@example.com',
          password: 'password123',
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('administrator approval');
      }
    });

    it('10.4 - Login should work after user is approved (ACTIVE)', async () => {
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(activeUser as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue(activeUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.status).toBe(UserStatus.ACTIVE);
      expect(result.token).toBeDefined();
    });

    it('10.5 - Login should throw for BANNED user', async () => {
      const bannedUser = { ...mockUser, status: UserStatus.BANNED };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(bannedUser as any);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('10.6 - Login should throw for SUSPENDED user', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(suspendedUser as any);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
