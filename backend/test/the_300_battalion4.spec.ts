/**
 * 👮 BATTALION 4: THE GATEKEEPER
 * Security & Admin Tests (50 Tests)
 * 
 * Tests the security system including:
 * - Authentication and authorization
 * - Token validation and expiration
 * - SQL injection prevention
 * - Role-based access control
 * - User banning and restrictions
 */

import * as crypto from 'crypto';

/**
 * User roles in the system
 */
enum UserRole {
  USER = 'USER',
  VIP = 'VIP',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

/**
 * User status
 */
enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

/**
 * JWT Token structure
 */
interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * User entity
 */
interface User {
  id: string;
  email: string;
  password: string; // Hashed
  role: UserRole;
  status: UserStatus;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Authentication Service
 */
class AuthService {
  private users: Map<string, User> = new Map();
  private tokens: Map<string, JWTPayload> = new Map();
  private blacklistedTokens: Set<string> = new Set();
  private readonly TOKEN_EXPIRY = 3600; // 1 hour in seconds
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  createUser(email: string, password: string, role: UserRole = UserRole.USER): { success: boolean; userId?: string; error?: string } {
    // Validate email format
    if (!this.isValidEmail(email)) {
      return { success: false, error: 'Invalid email format' };
    }

    // Check for SQL injection attempts
    if (this.containsSQLInjection(email)) {
      return { success: false, error: 'Invalid characters in email' };
    }

    // Check if email already exists
    for (const user of this.users.values()) {
      if (user.email === email) {
        return { success: false, error: 'Email already registered' };
      }
    }

    // Validate password strength
    if (!this.isStrongPassword(password)) {
      return { success: false, error: 'Password does not meet requirements' };
    }

    const userId = crypto.randomUUID();
    const hashedPassword = this.hashPassword(password);

    const user: User = {
      id: userId,
      email,
      password: hashedPassword,
      role,
      status: UserStatus.ACTIVE,
      twoFactorEnabled: false,
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };

    this.users.set(userId, user);
    return { success: true, userId };
  }

  login(email: string, password: string): { success: boolean; token?: string; error?: string } {
    // Find user by email
    let user: User | undefined;
    for (const u of this.users.values()) {
      if (u.email === email) {
        user = u;
        break;
      }
    }

    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { success: false, error: 'Account is locked. Try again later.' };
    }

    // Check if account is banned
    if (user.status === UserStatus.BANNED) {
      return { success: false, error: 'Account is banned' };
    }

    // Check if account is suspended
    if (user.status === UserStatus.SUSPENDED) {
      return { success: false, error: 'Account is suspended' };
    }

    // Verify password
    if (!this.verifyPassword(password, user.password)) {
      user.failedLoginAttempts++;
      
      if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
      }
      
      return { success: false, error: 'Invalid credentials' };
    }

    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();

    // Generate token
    const token = this.generateToken(user);
    return { success: true, token };
  }

  validateToken(token: string): { valid: boolean; payload?: JWTPayload; error?: string } {
    if (this.blacklistedTokens.has(token)) {
      return { valid: false, error: 'Token has been revoked' };
    }

    const payload = this.tokens.get(token);
    if (!payload) {
      return { valid: false, error: 'Invalid token' };
    }

    // Check expiration
    if (payload.exp < Date.now() / 1000) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, payload };
  }

  logout(token: string): boolean {
    this.blacklistedTokens.add(token);
    return true;
  }

  private generateToken(user: User): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      iat: now,
      exp: now + this.TOKEN_EXPIRY,
    };

    const token = crypto.randomBytes(32).toString('hex');
    this.tokens.set(token, payload);
    return token;
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isStrongPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password);
  }

  private containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /'\s*OR\s*'?1'?\s*=\s*'?1/i,
      /'\s*OR\s*''='/i,
      /;\s*DROP\s+TABLE/i,
      /;\s*DELETE\s+FROM/i,
      /UNION\s+SELECT/i,
      /--/,
      /\/\*/,
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  banUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.status = UserStatus.BANNED;
    return true;
  }

  suspendUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.status = UserStatus.SUSPENDED;
    return true;
  }

  unbanUser(userId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    user.status = UserStatus.ACTIVE;
    return true;
  }
}

/**
 * Authorization Service
 */
class AuthorizationService {
  private readonly ROLE_HIERARCHY: Record<UserRole, number> = {
    [UserRole.USER]: 1,
    [UserRole.VIP]: 2,
    [UserRole.MODERATOR]: 3,
    [UserRole.ADMIN]: 4,
    [UserRole.SUPER_ADMIN]: 5,
  };

  private readonly ENDPOINT_PERMISSIONS: Record<string, UserRole> = {
    '/api/user/profile': UserRole.USER,
    '/api/user/settings': UserRole.USER,
    '/api/vip/rewards': UserRole.VIP,
    '/api/mod/chat/ban': UserRole.MODERATOR,
    '/api/admin/users': UserRole.ADMIN,
    '/api/admin/approve': UserRole.ADMIN,
    '/api/admin/settings': UserRole.ADMIN,
    '/api/super/config': UserRole.SUPER_ADMIN,
  };

  canAccess(userRole: UserRole, endpoint: string): boolean {
    const requiredRole = this.ENDPOINT_PERMISSIONS[endpoint];
    if (!requiredRole) return true; // Public endpoint
    
    return this.ROLE_HIERARCHY[userRole] >= this.ROLE_HIERARCHY[requiredRole];
  }

  hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return this.ROLE_HIERARCHY[userRole] >= this.ROLE_HIERARCHY[requiredRole];
  }

  isAdmin(userRole: UserRole): boolean {
    return this.ROLE_HIERARCHY[userRole] >= this.ROLE_HIERARCHY[UserRole.ADMIN];
  }

  isModerator(userRole: UserRole): boolean {
    return this.ROLE_HIERARCHY[userRole] >= this.ROLE_HIERARCHY[UserRole.MODERATOR];
  }
}

/**
 * Rate Limiter
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly WINDOW_MS = 60000; // 1 minute
  private readonly MAX_REQUESTS = 100;

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    
    let timestamps = this.requests.get(identifier) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    
    if (timestamps.length >= this.MAX_REQUESTS) {
      return false;
    }
    
    timestamps.push(now);
    this.requests.set(identifier, timestamps);
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.WINDOW_MS;
    
    let timestamps = this.requests.get(identifier) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    
    return Math.max(0, this.MAX_REQUESTS - timestamps.length);
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

/**
 * Input Sanitizer
 */
class InputSanitizer {
  sanitizeString(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];
    return xssPatterns.some(pattern => pattern.test(input));
  }

  containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /'\s*OR\s*'?1'?\s*=\s*'?1/i,
      /'\s*OR\s*''='/i,
      /;\s*DROP\s+TABLE/i,
      /;\s*DELETE\s+FROM/i,
      /UNION\s+SELECT/i,
      /--/,
      /\/\*/,
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// Test Suite
describe('👮 BATTALION 4: THE GATEKEEPER (Security & Admin)', () => {
  let authService: AuthService;
  let authzService: AuthorizationService;
  let rateLimiter: RateLimiter;
  let sanitizer: InputSanitizer;

  beforeEach(() => {
    authService = new AuthService();
    authzService = new AuthorizationService();
    rateLimiter = new RateLimiter();
    sanitizer = new InputSanitizer();
  });

  // ============================================
  // SECTION 1: Authentication (15 tests)
  // ============================================
  describe('Authentication', () => {
    test('1.1 - Should create user with valid credentials', () => {
      const result = authService.createUser('test@example.com', 'Password123');
      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
    });

    test('1.2 - Should reject invalid email format', () => {
      const result = authService.createUser('invalid-email', 'Password123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email');
    });

    test('1.3 - Should reject weak password', () => {
      const result = authService.createUser('test@example.com', 'weak');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Password');
    });

    test('1.4 - Should reject duplicate email', () => {
      authService.createUser('test@example.com', 'Password123');
      const result = authService.createUser('test@example.com', 'Password456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    test('1.5 - Should login with valid credentials', () => {
      authService.createUser('test@example.com', 'Password123');
      const result = authService.login('test@example.com', 'Password123');
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    test('1.6 - Should reject login with wrong password', () => {
      authService.createUser('test@example.com', 'Password123');
      const result = authService.login('test@example.com', 'WrongPassword');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    test('1.7 - Should reject login with non-existent email', () => {
      const result = authService.login('nonexistent@example.com', 'Password123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    test('1.8 - Should validate valid token', () => {
      authService.createUser('test@example.com', 'Password123');
      const loginResult = authService.login('test@example.com', 'Password123');
      
      const validateResult = authService.validateToken(loginResult.token!);
      expect(validateResult.valid).toBe(true);
      expect(validateResult.payload?.email).toBe('test@example.com');
    });

    test('1.9 - Should reject invalid token', () => {
      const result = authService.validateToken('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token');
    });

    test('1.10 - Should reject blacklisted token after logout', () => {
      authService.createUser('test@example.com', 'Password123');
      const loginResult = authService.login('test@example.com', 'Password123');
      
      authService.logout(loginResult.token!);
      
      const validateResult = authService.validateToken(loginResult.token!);
      expect(validateResult.valid).toBe(false);
      expect(validateResult.error).toContain('revoked');
    });

    test('1.11 - Should lock account after 5 failed attempts', () => {
      authService.createUser('test@example.com', 'Password123');
      
      for (let i = 0; i < 5; i++) {
        authService.login('test@example.com', 'WrongPassword');
      }
      
      const result = authService.login('test@example.com', 'Password123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });

    test('1.12 - Should reject SQL injection in email', () => {
      const result = authService.createUser("' OR 1=1 --", 'Password123');
      expect(result.success).toBe(false);
    });

    test('1.13 - Should reject SQL injection variant', () => {
      const result = authService.createUser("admin'--", 'Password123');
      expect(result.success).toBe(false);
    });

    test('1.14 - Should reject UNION SELECT injection', () => {
      const result = authService.createUser("' UNION SELECT * FROM users --", 'Password123');
      expect(result.success).toBe(false);
    });

    test('1.15 - Should reject DROP TABLE injection', () => {
      const result = authService.createUser("'; DROP TABLE users; --", 'Password123');
      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // SECTION 2: Authorization (15 tests)
  // ============================================
  describe('Authorization', () => {
    test('2.1 - USER should access /api/user/profile', () => {
      expect(authzService.canAccess(UserRole.USER, '/api/user/profile')).toBe(true);
    });

    test('2.2 - USER should NOT access /api/admin/users', () => {
      expect(authzService.canAccess(UserRole.USER, '/api/admin/users')).toBe(false);
    });

    test('2.3 - USER should NOT access /api/admin/approve', () => {
      expect(authzService.canAccess(UserRole.USER, '/api/admin/approve')).toBe(false);
    });

    test('2.4 - ADMIN should access /api/admin/users', () => {
      expect(authzService.canAccess(UserRole.ADMIN, '/api/admin/users')).toBe(true);
    });

    test('2.5 - ADMIN should access /api/admin/approve', () => {
      expect(authzService.canAccess(UserRole.ADMIN, '/api/admin/approve')).toBe(true);
    });

    test('2.6 - ADMIN should NOT access /api/super/config', () => {
      expect(authzService.canAccess(UserRole.ADMIN, '/api/super/config')).toBe(false);
    });

    test('2.7 - SUPER_ADMIN should access everything', () => {
      expect(authzService.canAccess(UserRole.SUPER_ADMIN, '/api/user/profile')).toBe(true);
      expect(authzService.canAccess(UserRole.SUPER_ADMIN, '/api/admin/users')).toBe(true);
      expect(authzService.canAccess(UserRole.SUPER_ADMIN, '/api/super/config')).toBe(true);
    });

    test('2.8 - VIP should access VIP endpoints', () => {
      expect(authzService.canAccess(UserRole.VIP, '/api/vip/rewards')).toBe(true);
    });

    test('2.9 - USER should NOT access VIP endpoints', () => {
      expect(authzService.canAccess(UserRole.USER, '/api/vip/rewards')).toBe(false);
    });

    test('2.10 - MODERATOR should access mod endpoints', () => {
      expect(authzService.canAccess(UserRole.MODERATOR, '/api/mod/chat/ban')).toBe(true);
    });

    test('2.11 - isAdmin should return true for ADMIN', () => {
      expect(authzService.isAdmin(UserRole.ADMIN)).toBe(true);
    });

    test('2.12 - isAdmin should return false for USER', () => {
      expect(authzService.isAdmin(UserRole.USER)).toBe(false);
    });

    test('2.13 - isModerator should return true for MODERATOR', () => {
      expect(authzService.isModerator(UserRole.MODERATOR)).toBe(true);
    });

    test('2.14 - isModerator should return true for ADMIN (higher role)', () => {
      expect(authzService.isModerator(UserRole.ADMIN)).toBe(true);
    });

    test('2.15 - Public endpoints should be accessible by all', () => {
      expect(authzService.canAccess(UserRole.USER, '/api/public/games')).toBe(true);
    });
  });

  // ============================================
  // SECTION 3: Ban Hammer (10 tests)
  // ============================================
  describe('Ban Hammer', () => {
    test('3.1 - Should ban user successfully', () => {
      const createResult = authService.createUser('test@example.com', 'Password123');
      const result = authService.banUser(createResult.userId!);
      expect(result).toBe(true);
      
      const user = authService.getUser(createResult.userId!);
      expect(user?.status).toBe(UserStatus.BANNED);
    });

    test('3.2 - Banned user should NOT be able to login', () => {
      const createResult = authService.createUser('test@example.com', 'Password123');
      authService.banUser(createResult.userId!);
      
      const loginResult = authService.login('test@example.com', 'Password123');
      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('banned');
    });

    test('3.3 - Should suspend user successfully', () => {
      const createResult = authService.createUser('test@example.com', 'Password123');
      const result = authService.suspendUser(createResult.userId!);
      expect(result).toBe(true);
      
      const user = authService.getUser(createResult.userId!);
      expect(user?.status).toBe(UserStatus.SUSPENDED);
    });

    test('3.4 - Suspended user should NOT be able to login', () => {
      const createResult = authService.createUser('test@example.com', 'Password123');
      authService.suspendUser(createResult.userId!);
      
      const loginResult = authService.login('test@example.com', 'Password123');
      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('suspended');
    });

    test('3.5 - Should unban user successfully', () => {
      const createResult = authService.createUser('test@example.com', 'Password123');
      authService.banUser(createResult.userId!);
      authService.unbanUser(createResult.userId!);
      
      const user = authService.getUser(createResult.userId!);
      expect(user?.status).toBe(UserStatus.ACTIVE);
    });

    test('3.6 - Unbanned user should be able to login', () => {
      const createResult = authService.createUser('test@example.com', 'Password123');
      authService.banUser(createResult.userId!);
      authService.unbanUser(createResult.userId!);
      
      const loginResult = authService.login('test@example.com', 'Password123');
      expect(loginResult.success).toBe(true);
    });

    test('3.7 - Ban non-existent user should fail', () => {
      const result = authService.banUser('non-existent-id');
      expect(result).toBe(false);
    });

    test('3.8 - Suspend non-existent user should fail', () => {
      const result = authService.suspendUser('non-existent-id');
      expect(result).toBe(false);
    });

    test('3.9 - Unban non-existent user should fail', () => {
      const result = authService.unbanUser('non-existent-id');
      expect(result).toBe(false);
    });

    test('3.10 - New user should have ACTIVE status', () => {
      const createResult = authService.createUser('test@example.com', 'Password123');
      const user = authService.getUser(createResult.userId!);
      expect(user?.status).toBe(UserStatus.ACTIVE);
    });
  });

  // ============================================
  // SECTION 4: Input Validation (10 tests)
  // ============================================
  describe('Input Validation', () => {
    test('4.1 - Should detect XSS in script tag', () => {
      expect(sanitizer.containsXSS('<script>alert("xss")</script>')).toBe(true);
    });

    test('4.2 - Should detect XSS in javascript: protocol', () => {
      expect(sanitizer.containsXSS('javascript:alert("xss")')).toBe(true);
    });

    test('4.3 - Should detect XSS in onclick handler', () => {
      expect(sanitizer.containsXSS('<img onclick="alert(1)">')).toBe(true);
    });

    test('4.4 - Should detect XSS in iframe', () => {
      expect(sanitizer.containsXSS('<iframe src="evil.com">')).toBe(true);
    });

    test('4.5 - Should sanitize HTML entities', () => {
      const result = sanitizer.sanitizeString('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    test('4.6 - Should detect SQL injection', () => {
      expect(sanitizer.containsSQLInjection("' OR 1=1 --")).toBe(true);
    });

    test('4.7 - Should validate valid username', () => {
      expect(sanitizer.isValidUsername('user123')).toBe(true);
    });

    test('4.8 - Should reject username with special characters', () => {
      expect(sanitizer.isValidUsername('user@123')).toBe(false);
    });

    test('4.9 - Should reject username too short', () => {
      expect(sanitizer.isValidUsername('ab')).toBe(false);
    });

    test('4.10 - Should reject username too long', () => {
      expect(sanitizer.isValidUsername('a'.repeat(25))).toBe(false);
    });
  });
});
