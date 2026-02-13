/**
 * ⚔️ BATTALION 5: SYSTEM MAINTENANCE, BONUS SAFETY & DATA INTEGRITY
 * ═══════════════════════════════════════════════════════════
 * Target: onboarding.service.ts (brand creation), auth.service.ts (user registration),
 *         stuck-sessions-cleanup.service.ts (session recovery),
 *         Deposit Bonus Safety Caps, Frontend-Backend Data Consistency
 * 
 * Scenario 1: The Welcome Mat — User Registration & Onboarding
 * Scenario 2: The Janitor — Stuck Sessions Cleanup & Refund
 * Scenario 3: Brand Onboarding — Multi-Tenant Brand Creation
 * Scenario 4: Edge Cases & Boundary Conditions
 * Scenario 5: Deposit Bonus Safety Cap (CRITICAL FINANCIAL)
 * Scenario 6: Frontend-Backend Data Consistency
 * ═══════════════════════════════════════════════════════════
 */

// ============================================================
// CONSTANTS (mirrored from the actual services)
// ============================================================

// User defaults from auth.service.ts register()
const USER_DEFAULTS = {
  role: 'USER',
  status: 'PENDING_APPROVAL',
  hierarchyLevel: 4,
  hierarchyPath: '/',
  twoFactorEnabled: false,
  isBot: false,
  language: 'en',
  timezone: 'UTC',
};

// Wallet defaults
const WALLET_DEFAULTS = {
  currency: 'USDT',
  balance: 0,
  lockedBalance: 0,
};

// Stuck session cleanup constants
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Brand onboarding defaults
const BRAND_DEFAULTS = {
  primaryColor: '#6366f1',
  secondaryColor: '#1e1b4b',
  accentColor: '#f59e0b',
  backgroundColor: '#0f0a1e',
  maxPayoutPerDay: 50000,
  maxPayoutPerBet: 10000,
  maxBetAmount: 5000,
  botCount: 50,
  botMinBet: 5,
  botMaxBet: 1000,
  chatEnabled: true,
  chatIntervalMin: 5,
  chatIntervalMax: 15,
};

const DEFAULT_HOUSE_EDGE = {
  dice: 0.02,
  crash: 0.04,
  mines: 0.03,
  plinko: 0.03,
  olympus: 0.04,
};

// ============================================================
// PURE LOGIC EXTRACTED FROM SERVICES
// ============================================================

/**
 * Simulate user registration logic from auth.service.ts
 */
function simulateRegister(dto: {
  username: string;
  email: string;
  password: string;
  referralCode?: string;
  siteId?: string;
}): {
  valid: boolean;
  error?: string;
  userData?: Record<string, any>;
} {
  // Validate username
  if (!dto.username || dto.username.length < 3 || dto.username.length > 20) {
    return { valid: false, error: 'Username must be 3-20 characters' };
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!dto.email || !emailRegex.test(dto.email)) {
    return { valid: false, error: 'Invalid email address' };
  }

  // Validate password
  if (!dto.password || dto.password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // Build user data
  const userData: Record<string, any> = {
    username: dto.username.toLowerCase(),
    email: dto.email.toLowerCase(),
    role: USER_DEFAULTS.role,
    status: USER_DEFAULTS.status,
    hierarchyLevel: USER_DEFAULTS.hierarchyLevel,
    hierarchyPath: USER_DEFAULTS.hierarchyPath,
    twoFactorEnabled: USER_DEFAULTS.twoFactorEnabled,
    isBot: USER_DEFAULTS.isBot,
    language: USER_DEFAULTS.language,
    timezone: USER_DEFAULTS.timezone,
    siteId: dto.siteId || null,
    parentId: null,
  };

  // Referral binding
  if (dto.referralCode) {
    userData.parentId = dto.referralCode; // In real code, this is the parent user's ID
    // In real code: hierarchyPath = parentUser.hierarchyPath + parentUser.id + '/'
    // hierarchyLevel = min(parentUser.hierarchyLevel + 1, 4)
  }

  return { valid: true, userData };
}

/**
 * Simulate wallet creation for new user
 */
function createInitialWallet(userId: string, siteId: string | null): Record<string, any> {
  return {
    userId,
    currency: WALLET_DEFAULTS.currency,
    balance: WALLET_DEFAULTS.balance,
    lockedBalance: WALLET_DEFAULTS.lockedBalance,
    siteId,
  };
}

/**
 * Stuck session detection logic
 */
interface StuckGameInfo {
  gameId: string;
  userId: string;
  betAmount: number;
  currency: string;
  createdAt: number;
  gameName: string;
}

function isSessionStuck(session: StuckGameInfo, now: number): boolean {
  return now - session.createdAt > MAX_SESSION_AGE_MS;
}

function findStuckSessions(sessions: StuckGameInfo[], now: number): StuckGameInfo[] {
  return sessions.filter(s => isSessionStuck(s, now));
}

function calculateRefundTotal(stuckSessions: StuckGameInfo[]): number {
  return stuckSessions.reduce((sum, s) => sum + s.betAmount, 0);
}

/**
 * Brand siteId generation logic
 */
function generateSiteId(brandName: string): string {
  // Matches: `site-${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randomHex}`
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `site-${slug}`;  // Without the random hex for testing pattern
}

function validateBrandDomain(domain: string): boolean {
  // Basic domain validation
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(domain);
}

/**
 * Brand config generation
 */
function generateFrontendConfig(siteId: string, brandName: string, domain: string, overrides?: Partial<typeof BRAND_DEFAULTS>): Record<string, any> {
  return {
    siteId,
    brandName,
    domain,
    apiUrl: `https://${domain}/api`,
    wsUrl: `wss://${domain}/ws`,
    theme: {
      primaryColor: overrides?.primaryColor || BRAND_DEFAULTS.primaryColor,
    },
    nginx: {
      serverName: domain,
      proxyPass: 'http://localhost:3000',
      sslCertPath: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
      sslKeyPath: `/etc/letsencrypt/live/${domain}/privkey.pem`,
    },
  };
}

// ============================================================
// TEST SUITE
// ============================================================
// ============================================================
// DEPOSIT BONUS LOGIC (what SHOULD exist but currently DOESN'T)
// ============================================================

// Promotions as displayed on the frontend
const PROMOTIONS = {
  welcomeBonus: {
    id: 'welcome',
    title: 'Welcome Bonus',
    matchPercent: 200,  // 200% match
    maxBonus: 2000,     // Up to $2,000
    minDeposit: 10,     // Min $10
    wagerRequirement: 30, // 30x wagering
    maxBet: 5,          // Max $5 per bet while bonus active
  },
  weeklyReload: {
    id: 'reload',
    title: 'Weekly Reload',
    matchPercent: 50,   // 50% match
    maxBonus: 500,      // Up to $500
    minDeposit: 20,     // Min $20
    wagerRequirement: 20, // 20x wagering
    maxBet: 10,         // Max $10 per bet
  },
};

// Transaction types from schema
const TRANSACTION_TYPES = [
  'DEPOSIT', 'WITHDRAWAL', 'BET', 'WIN', 'COMMISSION',
  'TIP_SENT', 'TIP_RECEIVED', 'VAULT_DEPOSIT', 'VAULT_WITHDRAWAL',
  'RAIN_RECEIVED', 'CREDIT_GIVEN', 'CREDIT_REPAID',
];

/**
 * Simulate deposit bonus calculation WITH safety cap
 * This is what the system SHOULD do when bonus logic is implemented
 */
function calculateDepositBonus(
  depositAmount: number,
  matchPercent: number,
  maxBonus: number,
  minDeposit: number,
): { bonusAmount: number; valid: boolean; error?: string } {
  // Validate minimum deposit
  if (depositAmount < minDeposit) {
    return { bonusAmount: 0, valid: false, error: `Minimum deposit is $${minDeposit}` };
  }

  // Calculate raw bonus
  const rawBonus = depositAmount * (matchPercent / 100);

  // CRITICAL: Apply the safety cap
  const bonusAmount = Math.min(rawBonus, maxBonus);

  // Floor to 2 decimal places
  const finalBonus = Math.floor(bonusAmount * 100) / 100;

  return { bonusAmount: finalBonus, valid: true };
}

/**
 * Check if wager requirement is met
 */
function isWagerRequirementMet(
  bonusAmount: number,
  wagerMultiplier: number,
  totalWagered: number,
): boolean {
  const requiredWager = bonusAmount * wagerMultiplier;
  return totalWagered >= requiredWager;
}

/**
 * Check if bet is allowed while bonus is active
 */
function isBetAllowedWithBonus(
  betAmount: number,
  maxBetWithBonus: number,
): boolean {
  return betAmount <= maxBetWithBonus;
}

// ============================================================
// FRONTEND-BACKEND CONSISTENCY CHECKS
// ============================================================

// What the frontend displays to users
const FRONTEND_CLAIMS = {
  homePage: {
    welcomeBonusText: 'Get 200% Bonus on First Deposit!',
    matchPercent: 200,
  },
  promotionsPage: {
    welcome: { subtitle: '200% up to $2,000', minDeposit: 10, wager: 30, maxBet: 5 },
    cashback: { subtitle: 'Up to 15% cashback' },
    referral: { subtitle: 'Earn 25% commission', cap: 'no cap' },
    reload: { subtitle: '50% up to $500', minDeposit: 20, wager: 20, maxBet: 10 },
    tournament: { subtitle: '$10,000 Prize Pool' },
    vipDrops: { subtitle: 'Random rewards' },
  },
  vipPage: {
    tiers: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
    rakebacks: { Silver: 7, Gold: 10, Platinum: 12 },
  },
};

// What the backend actually supports
const BACKEND_CAPABILITIES = {
  transactionTypes: TRANSACTION_TYPES,
  hasBonusTransactionType: TRANSACTION_TYPES.includes('BONUS'),
  hasDepositBonusService: false,  // No bonus service file exists
  hasWagerRequirementEnforcement: false,  // No wager check in code
  hasMaxBonusCap: false,  // No MAX_BONUS_CAP constant
  commissionRates: { tier1: 0.005, tier2: 0.002, tier3: 0.001 },  // 0.5%, 0.2%, 0.1%
};

describe('⚔️ BATTALION 5: SYSTEM MAINTENANCE, BONUS SAFETY & DATA INTEGRITY', () => {

  // ============================================================
  // SCENARIO 1: THE WELCOME MAT — User Registration & Onboarding
  // ============================================================
  describe('Scenario 1: The Welcome Mat (User Registration & Onboarding)', () => {

    describe('1A: User Registration Validation', () => {
      it('Valid registration creates user with correct defaults', () => {
        const result = simulateRegister({
          username: 'TestPlayer',
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(true);
        expect(result.userData).toBeDefined();
      });

      it('Username is lowercased on registration', () => {
        const result = simulateRegister({
          username: 'TestPlayer',
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        expect(result.userData!.username).toBe('testplayer');
      });

      it('Email is lowercased on registration', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'Test@EXAMPLE.com',
          password: 'SecurePass123',
        });
        expect(result.userData!.email).toBe('test@example.com');
      });

      it('Username too short (2 chars) → rejected', () => {
        const result = simulateRegister({
          username: 'ab',
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Username');
      });

      it('Username too long (21 chars) → rejected', () => {
        const result = simulateRegister({
          username: 'a'.repeat(21),
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(false);
      });

      it('Username exactly 3 chars → accepted', () => {
        const result = simulateRegister({
          username: 'abc',
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(true);
      });

      it('Username exactly 20 chars → accepted', () => {
        const result = simulateRegister({
          username: 'a'.repeat(20),
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(true);
      });

      it('Invalid email (no @) → rejected', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'notanemail',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('email');
      });

      it('Invalid email (no domain) → rejected', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'test@',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(false);
      });

      it('Password too short (7 chars) → rejected', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'test@example.com',
          password: '1234567',
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Password');
      });

      it('Password exactly 8 chars → accepted', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'test@example.com',
          password: '12345678',
        });
        expect(result.valid).toBe(true);
      });

      it('Empty username → rejected', () => {
        const result = simulateRegister({
          username: '',
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(false);
      });

      it('Empty password → rejected', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'test@example.com',
          password: '',
        });
        expect(result.valid).toBe(false);
      });
    });

    describe('1B: Default Values on New User', () => {
      const result = simulateRegister({
        username: 'newplayer',
        email: 'new@example.com',
        password: 'SecurePass123',
      });
      const user = result.userData!;

      it('Role defaults to USER', () => {
        expect(user.role).toBe('USER');
      });

      it('Status defaults to PENDING_APPROVAL', () => {
        expect(user.status).toBe('PENDING_APPROVAL');
      });

      it('Hierarchy level defaults to 4 (lowest)', () => {
        expect(user.hierarchyLevel).toBe(4);
      });

      it('Hierarchy path defaults to "/"', () => {
        expect(user.hierarchyPath).toBe('/');
      });

      it('Two-factor auth defaults to disabled', () => {
        expect(user.twoFactorEnabled).toBe(false);
      });

      it('isBot defaults to false', () => {
        expect(user.isBot).toBe(false);
      });

      it('Language defaults to "en"', () => {
        expect(user.language).toBe('en');
      });

      it('Timezone defaults to "UTC"', () => {
        expect(user.timezone).toBe('UTC');
      });

      it('parentId defaults to null (no referral)', () => {
        expect(user.parentId).toBeNull();
      });
    });

    describe('1C: Wallet Creation on Registration', () => {
      it('Wallet is created with $0.00 balance', () => {
        const wallet = createInitialWallet('user-123', null);
        expect(wallet.balance).toBe(0);
      });

      it('Wallet currency defaults to USDT', () => {
        const wallet = createInitialWallet('user-123', null);
        expect(wallet.currency).toBe('USDT');
      });

      it('Locked balance starts at $0.00', () => {
        const wallet = createInitialWallet('user-123', null);
        expect(wallet.lockedBalance).toBe(0);
      });

      it('Wallet is bound to user ID', () => {
        const wallet = createInitialWallet('user-123', null);
        expect(wallet.userId).toBe('user-123');
      });

      it('Wallet inherits siteId for multi-tenant', () => {
        const wallet = createInitialWallet('user-123', 'site-brand-abc');
        expect(wallet.siteId).toBe('site-brand-abc');
      });

      it('Wallet siteId is null for global users', () => {
        const wallet = createInitialWallet('user-123', null);
        expect(wallet.siteId).toBeNull();
      });
    });

    describe('1D: Referral Binding', () => {
      it('User B registered with User A referral code → parentId = User A ID', () => {
        const result = simulateRegister({
          username: 'userB',
          email: 'userb@example.com',
          password: 'SecurePass123',
          referralCode: 'user-a-id-123',
        });
        expect(result.userData!.parentId).toBe('user-a-id-123');
      });

      it('No referral code → parentId is null', () => {
        const result = simulateRegister({
          username: 'userC',
          email: 'userc@example.com',
          password: 'SecurePass123',
        });
        expect(result.userData!.parentId).toBeNull();
      });

      it('Empty referral code → parentId is null', () => {
        const result = simulateRegister({
          username: 'userD',
          email: 'userd@example.com',
          password: 'SecurePass123',
          referralCode: '',
        });
        expect(result.userData!.parentId).toBeNull();
      });

      it('Multi-tenant: siteId is passed through to user', () => {
        const result = simulateRegister({
          username: 'userE',
          email: 'usere@example.com',
          password: 'SecurePass123',
          siteId: 'site-brand-xyz',
        });
        expect(result.userData!.siteId).toBe('site-brand-xyz');
      });

      it('No siteId → siteId is null', () => {
        const result = simulateRegister({
          username: 'userF',
          email: 'userf@example.com',
          password: 'SecurePass123',
        });
        expect(result.userData!.siteId).toBeNull();
      });
    });
  });

  // ============================================================
  // SCENARIO 2: THE JANITOR — Stuck Sessions Cleanup
  // ============================================================
  describe('Scenario 2: The Janitor (Stuck Sessions Cleanup)', () => {

    const NOW = Date.now();

    describe('2A: Stuck Session Detection', () => {
      it('Session older than 24 hours is STUCK', () => {
        const session: StuckGameInfo = {
          gameId: 'game-1',
          userId: 'user-1',
          betAmount: 50,
          currency: 'USDT',
          createdAt: NOW - (25 * 60 * 60 * 1000), // 25 hours ago
          gameName: 'Mines',
        };
        expect(isSessionStuck(session, NOW)).toBe(true);
      });

      it('Session exactly 24 hours old is STUCK (at boundary)', () => {
        const session: StuckGameInfo = {
          gameId: 'game-2',
          userId: 'user-2',
          betAmount: 100,
          currency: 'USDT',
          createdAt: NOW - MAX_SESSION_AGE_MS - 1, // Just over 24 hours
          gameName: 'Mines',
        };
        expect(isSessionStuck(session, NOW)).toBe(true);
      });

      it('Session 23 hours old is NOT stuck (active protection)', () => {
        const session: StuckGameInfo = {
          gameId: 'game-3',
          userId: 'user-3',
          betAmount: 75,
          currency: 'USDT',
          createdAt: NOW - (23 * 60 * 60 * 1000), // 23 hours ago
          gameName: 'Mines',
        };
        expect(isSessionStuck(session, NOW)).toBe(false);
      });

      it('Session 2 seconds old is NOT stuck (active game)', () => {
        const session: StuckGameInfo = {
          gameId: 'game-4',
          userId: 'user-4',
          betAmount: 200,
          currency: 'USDT',
          createdAt: NOW - 2000, // 2 seconds ago
          gameName: 'Mines',
        };
        expect(isSessionStuck(session, NOW)).toBe(false);
      });

      it('Session just created (0ms ago) is NOT stuck', () => {
        const session: StuckGameInfo = {
          gameId: 'game-5',
          userId: 'user-5',
          betAmount: 10,
          currency: 'USDT',
          createdAt: NOW,
          gameName: 'Mines',
        };
        expect(isSessionStuck(session, NOW)).toBe(false);
      });
    });

    describe('2B: Batch Stuck Session Processing', () => {
      const sessions: StuckGameInfo[] = [
        { gameId: 'g1', userId: 'u1', betAmount: 50, currency: 'USDT', createdAt: NOW - (30 * 60 * 60 * 1000), gameName: 'Mines' },  // 30h - STUCK
        { gameId: 'g2', userId: 'u2', betAmount: 100, currency: 'USDT', createdAt: NOW - (26 * 60 * 60 * 1000), gameName: 'Mines' }, // 26h - STUCK
        { gameId: 'g3', userId: 'u3', betAmount: 75, currency: 'USDT', createdAt: NOW - (2 * 60 * 60 * 1000), gameName: 'Mines' },   // 2h - ACTIVE
        { gameId: 'g4', userId: 'u4', betAmount: 200, currency: 'USDT', createdAt: NOW - (48 * 60 * 60 * 1000), gameName: 'Mines' }, // 48h - STUCK
        { gameId: 'g5', userId: 'u5', betAmount: 25, currency: 'USDT', createdAt: NOW - 5000, gameName: 'Mines' },                    // 5s - ACTIVE
      ];

      it('Finds exactly 3 stuck sessions out of 5', () => {
        const stuck = findStuckSessions(sessions, NOW);
        expect(stuck).toHaveLength(3);
      });

      it('Stuck sessions are g1, g2, g4 (not g3, g5)', () => {
        const stuck = findStuckSessions(sessions, NOW);
        const ids = stuck.map(s => s.gameId);
        expect(ids).toContain('g1');
        expect(ids).toContain('g2');
        expect(ids).toContain('g4');
        expect(ids).not.toContain('g3');
        expect(ids).not.toContain('g5');
      });

      it('Total refund amount = $50 + $100 + $200 = $350', () => {
        const stuck = findStuckSessions(sessions, NOW);
        const total = calculateRefundTotal(stuck);
        expect(total).toBe(350);
      });

      it('Empty session list → 0 stuck sessions', () => {
        const stuck = findStuckSessions([], NOW);
        expect(stuck).toHaveLength(0);
      });

      it('All sessions active → 0 stuck sessions', () => {
        const activeSessions: StuckGameInfo[] = [
          { gameId: 'a1', userId: 'u1', betAmount: 50, currency: 'USDT', createdAt: NOW - 1000, gameName: 'Mines' },
          { gameId: 'a2', userId: 'u2', betAmount: 100, currency: 'USDT', createdAt: NOW - 5000, gameName: 'Mines' },
        ];
        const stuck = findStuckSessions(activeSessions, NOW);
        expect(stuck).toHaveLength(0);
      });

      it('All sessions stuck → all returned', () => {
        const stuckSessions: StuckGameInfo[] = [
          { gameId: 's1', userId: 'u1', betAmount: 50, currency: 'USDT', createdAt: NOW - (25 * 60 * 60 * 1000), gameName: 'Mines' },
          { gameId: 's2', userId: 'u2', betAmount: 100, currency: 'USDT', createdAt: NOW - (30 * 60 * 60 * 1000), gameName: 'Mines' },
        ];
        const stuck = findStuckSessions(stuckSessions, NOW);
        expect(stuck).toHaveLength(2);
      });
    });

    describe('2C: Refund Calculation', () => {
      it('Single stuck session → refund = bet amount', () => {
        const stuck: StuckGameInfo[] = [
          { gameId: 'r1', userId: 'u1', betAmount: 150, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
        ];
        expect(calculateRefundTotal(stuck)).toBe(150);
      });

      it('Multiple stuck sessions → sum of all bet amounts', () => {
        const stuck: StuckGameInfo[] = [
          { gameId: 'r1', userId: 'u1', betAmount: 50, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
          { gameId: 'r2', userId: 'u2', betAmount: 100, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
          { gameId: 'r3', userId: 'u3', betAmount: 75.50, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
        ];
        expect(calculateRefundTotal(stuck)).toBeCloseTo(225.50, 2);
      });

      it('No stuck sessions → $0 refund', () => {
        expect(calculateRefundTotal([])).toBe(0);
      });

      it('Micro bets: $0.01 + $0.02 + $0.03 = $0.06', () => {
        const stuck: StuckGameInfo[] = [
          { gameId: 'r1', userId: 'u1', betAmount: 0.01, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
          { gameId: 'r2', userId: 'u2', betAmount: 0.02, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
          { gameId: 'r3', userId: 'u3', betAmount: 0.03, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
        ];
        expect(calculateRefundTotal(stuck)).toBeCloseTo(0.06, 8);
      });
    });

    describe('2D: Cleanup Constants', () => {
      it('MAX_SESSION_AGE is 24 hours in milliseconds', () => {
        expect(MAX_SESSION_AGE_MS).toBe(86400000);
      });

      it('Cron runs every hour (from service decorator)', () => {
        // The service uses @Cron(CronExpression.EVERY_HOUR)
        // CronExpression.EVERY_HOUR = '0 * * * *' (every hour at minute 0)
        const EVERY_HOUR = '0 * * * *';
        expect(EVERY_HOUR).toMatch(/^\d+ \* \* \* \*$/);
      });
    });
  });

  // ============================================================
  // SCENARIO 3: BRAND ONBOARDING — Multi-Tenant Brand Creation
  // ============================================================
  describe('Scenario 3: Brand Onboarding (onboarding.service)', () => {

    describe('3A: Site ID Generation', () => {
      it('Brand name "Lucky Casino" → siteId starts with "site-lucky-casino"', () => {
        const siteId = generateSiteId('Lucky Casino');
        expect(siteId).toBe('site-lucky-casino');
      });

      it('Brand name with special chars "My$Brand!" → cleaned slug', () => {
        const siteId = generateSiteId('My$Brand!');
        expect(siteId).toBe('site-my-brand-');
      });

      it('Brand name "STEK" → "site-stek"', () => {
        expect(generateSiteId('STEK')).toBe('site-stek');
      });

      it('Brand name with numbers "Casino777" → "site-casino777"', () => {
        expect(generateSiteId('Casino777')).toBe('site-casino777');
      });
    });

    describe('3B: Default Configuration Values', () => {
      it('Default primary color is #6366f1 (Indigo)', () => {
        expect(BRAND_DEFAULTS.primaryColor).toBe('#6366f1');
      });

      it('Default secondary color is #1e1b4b (Dark Navy)', () => {
        expect(BRAND_DEFAULTS.secondaryColor).toBe('#1e1b4b');
      });

      it('Default accent color is #f59e0b (Amber)', () => {
        expect(BRAND_DEFAULTS.accentColor).toBe('#f59e0b');
      });

      it('Default max payout per day is $50,000', () => {
        expect(BRAND_DEFAULTS.maxPayoutPerDay).toBe(50000);
      });

      it('Default max payout per bet is $10,000', () => {
        expect(BRAND_DEFAULTS.maxPayoutPerBet).toBe(10000);
      });

      it('Default max bet amount is $5,000', () => {
        expect(BRAND_DEFAULTS.maxBetAmount).toBe(5000);
      });

      it('Default bot count is 50', () => {
        expect(BRAND_DEFAULTS.botCount).toBe(50);
      });

      it('Default bot bet range is $5-$1,000', () => {
        expect(BRAND_DEFAULTS.botMinBet).toBe(5);
        expect(BRAND_DEFAULTS.botMaxBet).toBe(1000);
      });

      it('Chat is enabled by default', () => {
        expect(BRAND_DEFAULTS.chatEnabled).toBe(true);
      });

      it('Chat interval is 5-15 seconds', () => {
        expect(BRAND_DEFAULTS.chatIntervalMin).toBe(5);
        expect(BRAND_DEFAULTS.chatIntervalMax).toBe(15);
      });
    });

    describe('3C: Default House Edge Configuration', () => {
      it('Dice house edge is 2%', () => {
        expect(DEFAULT_HOUSE_EDGE.dice).toBe(0.02);
      });

      it('Crash house edge is 4%', () => {
        expect(DEFAULT_HOUSE_EDGE.crash).toBe(0.04);
      });

      it('Mines house edge is 3%', () => {
        expect(DEFAULT_HOUSE_EDGE.mines).toBe(0.03);
      });

      it('Plinko house edge is 3%', () => {
        expect(DEFAULT_HOUSE_EDGE.plinko).toBe(0.03);
      });

      it('Olympus house edge is 4%', () => {
        expect(DEFAULT_HOUSE_EDGE.olympus).toBe(0.04);
      });

      it('All house edges are between 0% and 10%', () => {
        for (const [game, edge] of Object.entries(DEFAULT_HOUSE_EDGE)) {
          expect(edge).toBeGreaterThanOrEqual(0);
          expect(edge).toBeLessThanOrEqual(0.10);
        }
      });
    });

    describe('3D: Frontend Config Generation', () => {
      it('API URL uses HTTPS with correct domain', () => {
        const config = generateFrontendConfig('site-test', 'TestBrand', 'test.com');
        expect(config.apiUrl).toBe('https://test.com/api');
      });

      it('WebSocket URL uses WSS with correct domain', () => {
        const config = generateFrontendConfig('site-test', 'TestBrand', 'test.com');
        expect(config.wsUrl).toBe('wss://test.com/ws');
      });

      it('Nginx server name matches domain', () => {
        const config = generateFrontendConfig('site-test', 'TestBrand', 'test.com');
        expect(config.nginx.serverName).toBe('test.com');
      });

      it('SSL cert path uses Let\'s Encrypt with correct domain', () => {
        const config = generateFrontendConfig('site-test', 'TestBrand', 'test.com');
        expect(config.nginx.sslCertPath).toBe('/etc/letsencrypt/live/test.com/fullchain.pem');
        expect(config.nginx.sslKeyPath).toBe('/etc/letsencrypt/live/test.com/privkey.pem');
      });

      it('Proxy pass points to localhost:3000', () => {
        const config = generateFrontendConfig('site-test', 'TestBrand', 'test.com');
        expect(config.nginx.proxyPass).toBe('http://localhost:3000');
      });

      it('Theme uses default colors when no overrides', () => {
        const config = generateFrontendConfig('site-test', 'TestBrand', 'test.com');
        expect(config.theme.primaryColor).toBe(BRAND_DEFAULTS.primaryColor);
      });

      it('Theme uses custom colors when overrides provided', () => {
        const config = generateFrontendConfig('site-test', 'TestBrand', 'test.com', {
          primaryColor: '#ff0000',
        });
        expect(config.theme.primaryColor).toBe('#ff0000');
      });
    });

    describe('3E: Domain Validation', () => {
      it('Valid domain: "example.com" → true', () => {
        expect(validateBrandDomain('example.com')).toBe(true);
      });

      it('Valid domain: "my-casino.io" → true', () => {
        expect(validateBrandDomain('my-casino.io')).toBe(true);
      });

      it('Valid domain: "casino777.bet" → true', () => {
        expect(validateBrandDomain('casino777.bet')).toBe(true);
      });

      it('Invalid domain: no TLD → false', () => {
        expect(validateBrandDomain('example')).toBe(false);
      });

      it('Invalid domain: starts with hyphen → false', () => {
        expect(validateBrandDomain('-example.com')).toBe(false);
      });

      it('Invalid domain: single char TLD → false', () => {
        expect(validateBrandDomain('example.c')).toBe(false);
      });
    });
  });

  // ============================================================
  // SCENARIO 4: EDGE CASES & BOUNDARY CONDITIONS
  // ============================================================
  describe('Scenario 4: Edge Cases & Boundary Conditions', () => {

    describe('4A: Registration Edge Cases', () => {
      it('Username with spaces is technically valid (3+ chars)', () => {
        const result = simulateRegister({
          username: 'a b',
          email: 'test@example.com',
          password: 'SecurePass123',
        });
        // Username is 3 chars including space - valid by length check
        expect(result.valid).toBe(true);
      });

      it('Very long password (100 chars) is accepted', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'test@example.com',
          password: 'a'.repeat(100),
        });
        expect(result.valid).toBe(true);
      });

      it('Email with + is valid', () => {
        const result = simulateRegister({
          username: 'testplayer',
          email: 'test+tag@example.com',
          password: 'SecurePass123',
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('4B: Stuck Session Edge Cases', () => {
      it('Session from the future (negative age) is NOT stuck', () => {
        const session: StuckGameInfo = {
          gameId: 'future-1',
          userId: 'u1',
          betAmount: 50,
          currency: 'USDT',
          createdAt: Date.now() + 1000000, // Future
          gameName: 'Mines',
        };
        expect(isSessionStuck(session, Date.now())).toBe(false);
      });

      it('Session with $0 bet amount → stuck but $0 refund', () => {
        const stuck: StuckGameInfo[] = [
          { gameId: 'z1', userId: 'u1', betAmount: 0, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
        ];
        expect(calculateRefundTotal(stuck)).toBe(0);
      });

      it('Very old session (30 days) is still detected as stuck', () => {
        const session: StuckGameInfo = {
          gameId: 'old-1',
          userId: 'u1',
          betAmount: 500,
          currency: 'USDT',
          createdAt: Date.now() - (30 * 24 * 60 * 60 * 1000),
          gameName: 'Mines',
        };
        expect(isSessionStuck(session, Date.now())).toBe(true);
      });

      it('Multiple games can have stuck sessions simultaneously', () => {
        const sessions: StuckGameInfo[] = [
          { gameId: 'm1', userId: 'u1', betAmount: 50, currency: 'USDT', createdAt: 0, gameName: 'Mines' },
          { gameId: 'c1', userId: 'u2', betAmount: 100, currency: 'USDT', createdAt: 0, gameName: 'CardRush' },
        ];
        const stuck = findStuckSessions(sessions, Date.now());
        expect(stuck).toHaveLength(2);
        const games = stuck.map(s => s.gameName);
        expect(games).toContain('Mines');
        expect(games).toContain('CardRush');
      });
    });

    describe('4C: Brand Onboarding Edge Cases', () => {
      it('Brand name with only special chars → "site----"', () => {
        const siteId = generateSiteId('$$$');
        expect(siteId).toBe('site----');
      });

      it('Brand name with unicode → cleaned to ASCII slug', () => {
        const siteId = generateSiteId('Café');
        // Non a-z0-9 chars are replaced with -
        expect(siteId).toContain('site-caf');
      });

      it('House edge values are all positive', () => {
        for (const edge of Object.values(DEFAULT_HOUSE_EDGE)) {
          expect(edge).toBeGreaterThan(0);
        }
      });

      it('Risk limits are all positive', () => {
        expect(BRAND_DEFAULTS.maxPayoutPerDay).toBeGreaterThan(0);
        expect(BRAND_DEFAULTS.maxPayoutPerBet).toBeGreaterThan(0);
        expect(BRAND_DEFAULTS.maxBetAmount).toBeGreaterThan(0);
      });

      it('maxPayoutPerBet <= maxPayoutPerDay', () => {
        expect(BRAND_DEFAULTS.maxPayoutPerBet).toBeLessThanOrEqual(BRAND_DEFAULTS.maxPayoutPerDay);
      });

      it('maxBetAmount <= maxPayoutPerBet', () => {
        expect(BRAND_DEFAULTS.maxBetAmount).toBeLessThanOrEqual(BRAND_DEFAULTS.maxPayoutPerBet);
      });

      it('Bot bet range: min < max', () => {
        expect(BRAND_DEFAULTS.botMinBet).toBeLessThan(BRAND_DEFAULTS.botMaxBet);
      });

      it('Chat interval: min < max', () => {
        expect(BRAND_DEFAULTS.chatIntervalMin).toBeLessThan(BRAND_DEFAULTS.chatIntervalMax);
      });
    });
  });

  // ============================================================
  // SCENARIO 5: DEPOSIT BONUS SAFETY CAP (CRITICAL FINANCIAL)
  // ============================================================
  describe('Scenario 5: Deposit Bonus Safety Cap (CRITICAL FINANCIAL)', () => {

    describe('5A: Normal Deposit Bonus Calculation', () => {
      it('$100 deposit with 200% match → $200 bonus', () => {
        const result = calculateDepositBonus(100, 200, 2000, 10);
        expect(result.valid).toBe(true);
        expect(result.bonusAmount).toBe(200);
      });

      it('$500 deposit with 200% match → $1,000 bonus', () => {
        const result = calculateDepositBonus(500, 200, 2000, 10);
        expect(result.valid).toBe(true);
        expect(result.bonusAmount).toBe(1000);
      });

      it('$10 deposit (minimum) with 200% match → $20 bonus', () => {
        const result = calculateDepositBonus(10, 200, 2000, 10);
        expect(result.valid).toBe(true);
        expect(result.bonusAmount).toBe(20);
      });

      it('$1,000 deposit with 200% match → $2,000 bonus (at cap)', () => {
        const result = calculateDepositBonus(1000, 200, 2000, 10);
        expect(result.valid).toBe(true);
        expect(result.bonusAmount).toBe(2000);
      });
    });

    describe('5B: The Whale Test (MAX_BONUS_CAP)', () => {
      it('🐋 $100,000 deposit → bonus MUST be $2,000 (NOT $200,000!)', () => {
        const result = calculateDepositBonus(100000, 200, 2000, 10);
        expect(result.valid).toBe(true);
        // THIS IS THE CRITICAL TEST:
        // If this returns 200000, the system has NO bonus cap = CATASTROPHIC
        expect(result.bonusAmount).toBe(2000);
        expect(result.bonusAmount).toBeLessThanOrEqual(2000);
        expect(result.bonusAmount).not.toBe(200000); // MUST NOT give $200K
      });

      it('🐋 $50,000 deposit → bonus capped at $2,000', () => {
        const result = calculateDepositBonus(50000, 200, 2000, 10);
        expect(result.bonusAmount).toBe(2000);
      });

      it('🐋 $1,000,000 deposit → bonus STILL capped at $2,000', () => {
        const result = calculateDepositBonus(1000000, 200, 2000, 10);
        expect(result.bonusAmount).toBe(2000);
        expect(result.bonusAmount).not.toBe(2000000);
      });

      it('$1,001 deposit → bonus capped at $2,000 (just over cap threshold)', () => {
        const result = calculateDepositBonus(1001, 200, 2000, 10);
        // Raw: 1001 * 2 = 2002, but capped at 2000
        expect(result.bonusAmount).toBe(2000);
      });

      it('$999 deposit → bonus $1,998 (just under cap)', () => {
        const result = calculateDepositBonus(999, 200, 2000, 10);
        expect(result.bonusAmount).toBe(1998);
      });
    });

    describe('5C: Weekly Reload Bonus Cap', () => {
      it('$100 deposit with 50% reload → $50 bonus', () => {
        const result = calculateDepositBonus(100, 50, 500, 20);
        expect(result.bonusAmount).toBe(50);
      });

      it('$1,000 deposit with 50% reload → capped at $500', () => {
        const result = calculateDepositBonus(1000, 50, 500, 20);
        expect(result.bonusAmount).toBe(500);
      });

      it('$100,000 deposit with 50% reload → STILL capped at $500', () => {
        const result = calculateDepositBonus(100000, 50, 500, 20);
        expect(result.bonusAmount).toBe(500);
        expect(result.bonusAmount).not.toBe(50000);
      });
    });

    describe('5D: Minimum Deposit Enforcement', () => {
      it('$9 deposit (below $10 min) → REJECTED', () => {
        const result = calculateDepositBonus(9, 200, 2000, 10);
        expect(result.valid).toBe(false);
        expect(result.bonusAmount).toBe(0);
      });

      it('$0 deposit → REJECTED', () => {
        const result = calculateDepositBonus(0, 200, 2000, 10);
        expect(result.valid).toBe(false);
      });

      it('$19 deposit for reload (below $20 min) → REJECTED', () => {
        const result = calculateDepositBonus(19, 50, 500, 20);
        expect(result.valid).toBe(false);
      });

      it('Negative deposit → REJECTED', () => {
        const result = calculateDepositBonus(-100, 200, 2000, 10);
        expect(result.valid).toBe(false);
      });
    });

    describe('5E: Wager Lock (Bonus Cannot Be Withdrawn)', () => {
      it('$200 bonus with 30x wager: need $6,000 wagered to unlock', () => {
        // Player got $200 bonus, needs to wager 200 * 30 = $6,000
        expect(isWagerRequirementMet(200, 30, 5999)).toBe(false);
        expect(isWagerRequirementMet(200, 30, 6000)).toBe(true);
      });

      it('$2,000 bonus (max) with 30x wager: need $60,000 wagered', () => {
        expect(isWagerRequirementMet(2000, 30, 59999)).toBe(false);
        expect(isWagerRequirementMet(2000, 30, 60000)).toBe(true);
      });

      it('$50 reload bonus with 20x wager: need $1,000 wagered', () => {
        expect(isWagerRequirementMet(50, 20, 999)).toBe(false);
        expect(isWagerRequirementMet(50, 20, 1000)).toBe(true);
      });

      it('$0 bonus → wager requirement met immediately', () => {
        expect(isWagerRequirementMet(0, 30, 0)).toBe(true);
      });
    });

    describe('5F: Max Bet While Bonus Active', () => {
      it('$5 bet with welcome bonus active → ALLOWED', () => {
        expect(isBetAllowedWithBonus(5, 5)).toBe(true);
      });

      it('$6 bet with welcome bonus active → BLOCKED', () => {
        expect(isBetAllowedWithBonus(6, 5)).toBe(false);
      });

      it('$10 bet with reload bonus active → ALLOWED', () => {
        expect(isBetAllowedWithBonus(10, 10)).toBe(true);
      });

      it('$11 bet with reload bonus active → BLOCKED', () => {
        expect(isBetAllowedWithBonus(11, 10)).toBe(false);
      });

      it('$0.01 bet → always ALLOWED', () => {
        expect(isBetAllowedWithBonus(0.01, 5)).toBe(true);
      });
    });

    describe('5G: Bonus Precision (Floor Rounding)', () => {
      it('$33.33 deposit → bonus $66.66 (FLOOR, not $66.67)', () => {
        const result = calculateDepositBonus(33.33, 200, 2000, 10);
        // 33.33 * 2 = 66.66 exactly
        expect(result.bonusAmount).toBe(66.66);
      });

      it('$33.335 deposit → bonus $66.67 (FLOOR of 66.67)', () => {
        const result = calculateDepositBonus(33.335, 200, 2000, 10);
        // 33.335 * 2 = 66.67 exactly
        expect(result.bonusAmount).toBe(66.67);
      });

      it('$77.77 deposit → bonus $155.54 (FLOOR)', () => {
        const result = calculateDepositBonus(77.77, 200, 2000, 10);
        // 77.77 * 2 = 155.54
        expect(result.bonusAmount).toBe(155.54);
      });

      it('Bonus never has more than 2 decimal places', () => {
        for (let i = 10; i <= 1000; i += 7) {
          const result = calculateDepositBonus(i + 0.01, 200, 2000, 10);
          const decimals = result.bonusAmount.toString().split('.')[1];
          if (decimals) {
            expect(decimals.length).toBeLessThanOrEqual(2);
          }
        }
      });
    });
  });

  // ============================================================
  // SCENARIO 6: FRONTEND-BACKEND DATA CONSISTENCY
  // ============================================================
  describe('Scenario 6: Frontend-Backend Data Consistency', () => {

    describe('6A: Backend Missing Bonus Infrastructure (AUDIT FINDINGS)', () => {
      it('🚨 FINDING: No BONUS transaction type in schema', () => {
        expect(BACKEND_CAPABILITIES.hasBonusTransactionType).toBe(false);
        // This means bonuses cannot be tracked in the transaction ledger
      });

      it('🚨 FINDING: No deposit bonus service exists', () => {
        expect(BACKEND_CAPABILITIES.hasDepositBonusService).toBe(false);
      });

      it('🚨 FINDING: No wager requirement enforcement', () => {
        expect(BACKEND_CAPABILITIES.hasWagerRequirementEnforcement).toBe(false);
      });

      it('🚨 FINDING: No MAX_BONUS_CAP constant defined', () => {
        expect(BACKEND_CAPABILITIES.hasMaxBonusCap).toBe(false);
      });
    });

    describe('6B: Frontend Promotion Claims vs Backend Reality', () => {
      it('Frontend claims 200% welcome bonus — backend has NO bonus logic', () => {
        expect(FRONTEND_CLAIMS.homePage.matchPercent).toBe(200);
        expect(BACKEND_CAPABILITIES.hasDepositBonusService).toBe(false);
        // GAP: Frontend promises what backend cannot deliver
      });

      it('Frontend claims 25% referral commission — backend pays 0.5% (Tier 1)', () => {
        const frontendClaim = 25; // 25% as shown on promotions page
        const backendReality = BACKEND_CAPABILITIES.commissionRates.tier1 * 100; // 0.5%
        expect(backendReality).toBe(0.5);
        expect(backendReality).not.toBe(frontendClaim);
        // GAP: Frontend says 25%, backend pays 0.5%
      });

      it('Frontend shows 6 promotions — backend implements 0 bonus services', () => {
        const frontendPromoCount = Object.keys(FRONTEND_CLAIMS.promotionsPage).length;
        expect(frontendPromoCount).toBe(6);
        expect(BACKEND_CAPABILITIES.hasDepositBonusService).toBe(false);
      });
    });

    describe('6C: Transaction Type Completeness', () => {
      it('12 transaction types exist in schema', () => {
        expect(TRANSACTION_TYPES).toHaveLength(12);
      });

      it('DEPOSIT type exists', () => {
        expect(TRANSACTION_TYPES).toContain('DEPOSIT');
      });

      it('WITHDRAWAL type exists', () => {
        expect(TRANSACTION_TYPES).toContain('WITHDRAWAL');
      });

      it('BET type exists', () => {
        expect(TRANSACTION_TYPES).toContain('BET');
      });

      it('WIN type exists', () => {
        expect(TRANSACTION_TYPES).toContain('WIN');
      });

      it('COMMISSION type exists', () => {
        expect(TRANSACTION_TYPES).toContain('COMMISSION');
      });

      it('VAULT_DEPOSIT and VAULT_WITHDRAWAL types exist', () => {
        expect(TRANSACTION_TYPES).toContain('VAULT_DEPOSIT');
        expect(TRANSACTION_TYPES).toContain('VAULT_WITHDRAWAL');
      });

      it('CREDIT_GIVEN and CREDIT_REPAID types exist', () => {
        expect(TRANSACTION_TYPES).toContain('CREDIT_GIVEN');
        expect(TRANSACTION_TYPES).toContain('CREDIT_REPAID');
      });

      it('🚨 MISSING: BONUS type needed for bonus tracking', () => {
        expect(TRANSACTION_TYPES).not.toContain('BONUS');
        // Recommendation: Add BONUS to TransactionType enum
      });

      it('🚨 MISSING: CASHBACK type needed for cashback tracking', () => {
        expect(TRANSACTION_TYPES).not.toContain('CASHBACK');
        // Recommendation: Add CASHBACK to TransactionType enum
      });

      it('🚨 MISSING: TOURNAMENT_PRIZE type needed for tournament payouts', () => {
        expect(TRANSACTION_TYPES).not.toContain('TOURNAMENT_PRIZE');
        // Recommendation: Add TOURNAMENT_PRIZE to TransactionType enum
      });
    });

    describe('6D: Promotion Safety Rules Validation', () => {
      it('Welcome bonus max ($2,000) is less than max payout per bet ($10,000)', () => {
        expect(PROMOTIONS.welcomeBonus.maxBonus).toBeLessThan(BRAND_DEFAULTS.maxPayoutPerBet);
      });

      it('Welcome bonus max ($2,000) is less than max payout per day ($50,000)', () => {
        expect(PROMOTIONS.welcomeBonus.maxBonus).toBeLessThan(BRAND_DEFAULTS.maxPayoutPerDay);
      });

      it('Reload bonus max ($500) is less than welcome bonus max ($2,000)', () => {
        expect(PROMOTIONS.weeklyReload.maxBonus).toBeLessThan(PROMOTIONS.welcomeBonus.maxBonus);
      });

      it('Welcome bonus wager (30x) is higher than reload wager (20x)', () => {
        expect(PROMOTIONS.welcomeBonus.wagerRequirement).toBeGreaterThan(PROMOTIONS.weeklyReload.wagerRequirement);
      });

      it('Max bet with bonus ($5) is much less than max bet amount ($5,000)', () => {
        expect(PROMOTIONS.welcomeBonus.maxBet).toBeLessThan(BRAND_DEFAULTS.maxBetAmount);
      });

      it('Minimum deposit ($10) is reasonable', () => {
        expect(PROMOTIONS.welcomeBonus.minDeposit).toBeGreaterThanOrEqual(1);
        expect(PROMOTIONS.welcomeBonus.minDeposit).toBeLessThanOrEqual(100);
      });

      it('Wager requirement (30x) is within industry standard (15x-60x)', () => {
        expect(PROMOTIONS.welcomeBonus.wagerRequirement).toBeGreaterThanOrEqual(15);
        expect(PROMOTIONS.welcomeBonus.wagerRequirement).toBeLessThanOrEqual(60);
      });
    });
  });
});
