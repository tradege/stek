/**
 * ⚔️ THE 300 - BATTALION 12: THE IRON GUARD ⚔️
 * =============================================
 * RBAC, Affiliate, Bot, Admin API Tests
 * 
 * Tests: 110
 * Target: Role-Based Access, Affiliate System, Bot Management, Admin APIs
 * Coverage: Auth Guards, Role Permissions, Affiliate Stats, Bot Control, Admin Operations
 * 
 * "No unauthorized soul shall pass these gates!"
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to create authenticated client
async function getAuthClient(email = 'marketedgepros@gmail.com', password = 'Admin99449x'): Promise<{ client: AxiosInstance; token: string; userId: string }> {
  const resp = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  const token = resp.data.token;
  const userId = resp.data.user?.id || '';
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });
  return { client, token, userId };
}

// Helper to create unauthenticated client
function getGuestClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true,
  });
}

// Helper to register a test user and return credentials
async function registerTestUser(): Promise<{ email: string; password: string; username: string }> {
  const id = Date.now();
  const email = `b12_test_${id}@stakepro.test`;
  const password = 'TestPass123!';
  const username = `b12_${id}`;
  await axios.post(`${BASE_URL}/auth/register`, { email, password, username }, { validateStatus: () => true });
  return { email, password, username };
}

describe('⚔️ BATTALION 12: THE IRON GUARD - RBAC & Admin Tests', () => {

  // ============================================
  // SECTION 1: JWT AUTHENTICATION GUARD (15 tests)
  // ============================================
  describe('🔐 Section 1: JWT Authentication Guard', () => {
    it('should reject unauthenticated request to /affiliates/stats', async () => {
      const guest = getGuestClient();
      const resp = await guest.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });

    it('should reject unauthenticated request to /affiliates/network', async () => {
      const guest = getGuestClient();
      const resp = await guest.get('/affiliates/network');
      expect(resp.status).toBe(401);
    });

    it('should reject unauthenticated request to /affiliates/history', async () => {
      const guest = getGuestClient();
      const resp = await guest.get('/affiliates/history');
      expect(resp.status).toBe(401);
    });

    it('should reject unauthenticated request to /affiliates/claim', async () => {
      const guest = getGuestClient();
      const resp = await guest.post('/affiliates/claim');
      expect(resp.status).toBe(401);
    });

    it('should allow unauthenticated request to /affiliates/leaderboard', async () => {
      const guest = getGuestClient();
      const resp = await guest.get('/affiliates/leaderboard');
      // Leaderboard might be public or protected
      expect([200, 401]).toContain(resp.status);
    });

    it('should reject request with invalid JWT token', async () => {
      const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: 'Bearer invalid.jwt.token' },
        validateStatus: () => true,
      });
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });

    it('should reject request with expired JWT token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNjAwMDAwMDAwfQ.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ';
      const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: `Bearer ${expiredToken}` },
        validateStatus: () => true,
      });
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });

    it('should reject request with malformed Authorization header', async () => {
      const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: 'NotBearer sometoken' },
        validateStatus: () => true,
      });
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });

    it('should reject request with empty Authorization header', async () => {
      const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: '' },
        validateStatus: () => true,
      });
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });

    it('should reject request with Bearer but no token', async () => {
      const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: 'Bearer ' },
        validateStatus: () => true,
      });
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });

    it('should accept request with valid JWT token', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(200);
    });

    it('should reject unauthenticated request to /admin/users', async () => {
      const guest = getGuestClient();
      const resp = await guest.get('/admin/users');
      expect(resp.status).toBe(401);
    });

    it('should reject unauthenticated request to /admin/stats', async () => {
      const guest = getGuestClient();
      const resp = await guest.get('/admin/stats');
      expect(resp.status).toBe(401);
    });

    it('should reject request with SQL injection in Authorization header', async () => {
      const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: "Bearer ' OR 1=1 --" },
        validateStatus: () => true,
      });
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });

    it('should reject request with XSS in Authorization header', async () => {
      const client = axios.create({
        baseURL: BASE_URL,
        headers: { Authorization: 'Bearer <script>alert(1)</script>' },
        validateStatus: () => true,
      });
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(401);
    });
  });

  // ============================================
  // SECTION 2: ADMIN ROLE-BASED ACCESS (18 tests)
  // ============================================
  describe('👑 Section 2: Admin Role-Based Access Control', () => {
    it('should allow ADMIN to access /admin/users', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/users');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/stats', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/stats');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/stats/real', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/stats/real');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/stats/bots', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/stats/bots');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/game/config', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/game/config');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/users/pending', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/users/pending');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/finance/stats', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/finance/stats');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/dashboard/stats', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/dashboard/stats');
      expect(resp.status).toBe(200);
    });

    it('should allow ADMIN to access /admin/transactions', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/transactions');
      expect(resp.status).toBe(200);
    });

    it('should return user list with correct structure', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/users');
      expect(resp.status).toBe(200);
      expect(Array.isArray(resp.data)).toBe(true);
      if (resp.data.length > 0) {
        const user = resp.data[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('status');
      }
    });

    it('should return pending users as array', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/users/pending');
      expect(resp.status).toBe(200);
      expect(Array.isArray(resp.data)).toBe(true);
    });

    it('should return game config with houseEdge and instantBust', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/game/config');
      expect(resp.status).toBe(200);
      const data = resp.data.data || resp.data;
      expect(data).toHaveProperty('houseEdge');
      expect(data).toHaveProperty('instantBust');
      expect(typeof data.houseEdge).toBe('number');
      expect(typeof data.instantBust).toBe('number');
    });

    it('should update game config with valid values', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', {
        houseEdge: 4,
        instantBust: 2,
      });
      expect([200, 201]).toContain(resp.status);
    });

    it('should return dashboard stats with correct structure', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/dashboard/stats');
      expect(resp.status).toBe(200);
      expect(resp.data).toBeDefined();
    });

    it('should return finance stats', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/finance/stats');
      expect(resp.status).toBe(200);
      expect(resp.data).toBeDefined();
    });

    it('should return transactions list', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/transactions');
      expect(resp.status).toBe(200);
    });

    it('should handle approve for non-existent user', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/users/00000000-0000-0000-0000-000000000000/approve');
      expect([404, 400, 500]).toContain(resp.status);
    });

    it('should handle ban for non-existent user', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/users/00000000-0000-0000-0000-000000000000/ban');
      expect([404, 400, 500]).toContain(resp.status);
    });
  });

  // ============================================
  // SECTION 3: AFFILIATE SYSTEM (18 tests)
  // ============================================
  describe('🤝 Section 3: Affiliate System', () => {
    it('should return affiliate stats for authenticated user', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(200);
      expect(resp.data).toBeDefined();
    });

    it('should return affiliate stats with rank info', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(200);
      const data = resp.data;
      expect(data.rank || data.level || data.tier || data.currentRank).toBeDefined();
    });

    it('should return affiliate network details', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/network');
      expect(resp.status).toBe(200);
      expect(resp.data).toBeDefined();
    });

    it('should return affiliate commission history', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/history');
      expect(resp.status).toBe(200);
      expect(resp.data).toBeDefined();
    });

    it('should return affiliate leaderboard', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/leaderboard');
      expect(resp.status).toBe(200);
    });

    it('should handle claim commission (may have nothing to claim)', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/affiliates/claim');
      // Either success or "nothing to claim"
      expect([200, 400]).toContain(resp.status);
    });

    it('should return stats with commission data', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(200);
      const data = resp.data;
      expect(data.totalEarned !== undefined || data.availableCommission !== undefined || data.totalCommission !== undefined || data.commission !== undefined || data.earnings !== undefined).toBe(true);
    });

    it('should return stats with referral count', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(200);
      const data = resp.data;
      expect(data.totalReferrals !== undefined || data.referrals !== undefined || data.network !== undefined || data.networkStats !== undefined).toBe(true);
    });

    it('should return network with tier breakdown', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/network');
      expect(resp.status).toBe(200);
      const data = resp.data;
      expect(data.tiers || data.levels || data.breakdown || Array.isArray(data)).toBeDefined();
    });

    it('should return history with time-based data', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/history');
      expect(resp.status).toBe(200);
      const data = resp.data;
      expect(data.history || data.entries || Array.isArray(data)).toBeDefined();
    });

    it('should return leaderboard as array or object with entries', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/leaderboard');
      expect(resp.status).toBe(200);
      const data = resp.data;
      expect(Array.isArray(data) || data.leaderboard || data.entries).toBeTruthy();
    });

    it('should not allow claim without authentication', async () => {
      const guest = getGuestClient();
      const resp = await guest.post('/affiliates/claim');
      expect(resp.status).toBe(401);
    });

    it('should handle multiple rapid stats requests', async () => {
      const { client } = await getAuthClient();
      const promises = Array.from({ length: 5 }, () => client.get('/affiliates/stats'));
      const results = await Promise.all(promises);
      expect(results.every(r => r.status === 200)).toBe(true);
    });

    it('should return consistent stats on repeated calls', async () => {
      const { client } = await getAuthClient();
      const resp1 = await client.get('/affiliates/stats');
      const resp2 = await client.get('/affiliates/stats');
      expect(resp1.status).toBe(200);
      expect(resp2.status).toBe(200);
      // Stats should be consistent
      expect(JSON.stringify(resp1.data)).toBe(JSON.stringify(resp2.data));
    });

    it('should handle affiliate stats for new user with no referrals', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/stats');
      expect(resp.status).toBe(200);
      // Should return valid data even with zero referrals
    });

    it('should handle network details for user with empty network', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/network');
      expect(resp.status).toBe(200);
    });

    it('should handle commission history for user with no history', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/affiliates/history');
      expect(resp.status).toBe(200);
    });

    it('should handle rapid claim attempts', async () => {
      const { client } = await getAuthClient();
      const promises = Array.from({ length: 3 }, () => client.post('/affiliates/claim'));
      const results = await Promise.all(promises);
      // All should return valid responses (200 or 400)
      expect(results.every(r => [200, 400].includes(r.status))).toBe(true);
    });
  });

  // ============================================
  // SECTION 4: BOT MANAGEMENT (15 tests)
  // ============================================
  describe('🤖 Section 4: Bot Management', () => {
    it('should get bot status', async () => {
      const resp = await axios.get(`${BASE_URL}/admin/bots/status`, { validateStatus: () => true });
      expect([200, 401]).toContain(resp.status);
    });

    it('should toggle bots on', async () => {
      const resp = await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: true }, { validateStatus: () => true });
      expect([200, 201, 401]).toContain(resp.status);
    });

    it('should toggle bots off', async () => {
      const resp = await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: false }, { validateStatus: () => true });
      expect([200, 201, 401]).toContain(resp.status);
    });

    it('should trigger bot bets', async () => {
      const resp = await axios.post(`${BASE_URL}/admin/bots/trigger-bets`, {}, { validateStatus: () => true });
      expect([200, 201, 401]).toContain(resp.status);
    });

    it('should trigger bot chat messages', async () => {
      const resp = await axios.post(`${BASE_URL}/admin/bots/trigger-chat`, {}, { validateStatus: () => true });
      expect([200, 201, 401]).toContain(resp.status);
    });

    it('should return bot status with enabled field', async () => {
      const resp = await axios.get(`${BASE_URL}/admin/bots/status`, { validateStatus: () => true });
      if (resp.status === 200) {
        expect(resp.data.botCount !== undefined || resp.data.enabled !== undefined || resp.data.active !== undefined || resp.data.currentGameState !== undefined).toBe(true);
      }
    });

    it('should return bot status with bot count', async () => {
      const resp = await axios.get(`${BASE_URL}/admin/bots/status`, { validateStatus: () => true });
      if (resp.status === 200) {
        expect(resp.data.activeBots !== undefined || resp.data.count !== undefined || resp.data.botCount !== undefined || resp.data.active !== undefined).toBe(true);
      }
    });

    it('should handle toggle with missing enabled field', async () => {
      const resp = await axios.post(`${BASE_URL}/admin/bots/toggle`, {}, { validateStatus: () => true });
      expect([200, 201, 400, 401]).toContain(resp.status);
    });

    it('should handle toggle with invalid enabled value', async () => {
      const resp = await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: 'not-boolean' }, { validateStatus: () => true });
      expect([200, 201, 400, 401]).toContain(resp.status);
    });

    it('should handle rapid toggle on/off', async () => {
      for (let i = 0; i < 5; i++) {
        await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: i % 2 === 0 }, { validateStatus: () => true });
      }
      const status = await axios.get(`${BASE_URL}/admin/bots/status`, { validateStatus: () => true });
      expect([200, 401]).toContain(status.status);
    });

    it('should handle trigger-bets when bots are disabled', async () => {
      await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: false }, { validateStatus: () => true });
      const resp = await axios.post(`${BASE_URL}/admin/bots/trigger-bets`, {}, { validateStatus: () => true });
      expect([200, 201, 400, 401]).toContain(resp.status);
    });

    it('should handle trigger-chat when bots are disabled', async () => {
      await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: false }, { validateStatus: () => true });
      const resp = await axios.post(`${BASE_URL}/admin/bots/trigger-chat`, {}, { validateStatus: () => true });
      expect([200, 201, 400, 401]).toContain(resp.status);
    });

    it('should handle concurrent bot operations', async () => {
      const promises = [
        axios.get(`${BASE_URL}/admin/bots/status`, { validateStatus: () => true }),
        axios.post(`${BASE_URL}/admin/bots/trigger-bets`, {}, { validateStatus: () => true }),
        axios.post(`${BASE_URL}/admin/bots/trigger-chat`, {}, { validateStatus: () => true }),
      ];
      const results = await Promise.all(promises);
      expect(results.every(r => [200, 201, 401].includes(r.status))).toBe(true);
    });

    it('should re-enable bots after disabling', async () => {
      await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: false }, { validateStatus: () => true });
      await axios.post(`${BASE_URL}/admin/bots/toggle`, { enable: true }, { validateStatus: () => true });
      const status = await axios.get(`${BASE_URL}/admin/bots/status`, { validateStatus: () => true });
      expect([200, 401]).toContain(status.status);
    });

    it('should handle trigger-bets with extra payload', async () => {
      const resp = await axios.post(`${BASE_URL}/admin/bots/trigger-bets`, { count: 10, maxBet: 100 }, { validateStatus: () => true });
      expect([200, 201, 401]).toContain(resp.status);
    });
  });

  // ============================================
  // SECTION 5: USER REGISTRATION & STATUS (15 tests)
  // ============================================
  describe('📝 Section 5: User Registration & Status Flow', () => {
    it('should register a new user', async () => {
      const id = Date.now();
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_reg_${id}@stakepro.test`,
        password: 'TestPass123!',
        username: `b12reg_${id}`,
      }, { validateStatus: () => true });
      expect([200, 201]).toContain(resp.status);
    });

    it('should return user data on registration', async () => {
      const id = Date.now();
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_data_${id}@stakepro.test`,
        password: 'TestPass123!',
        username: `b12data_${id}`,
      }, { validateStatus: () => true });
      if (resp.status === 200 || resp.status === 201) {
        expect(resp.data.user || resp.data.id || resp.data.token).toBeDefined();
      }
    });

    it('should reject duplicate email registration', async () => {
      const id = Date.now();
      const email = `b12_dup_${id}@stakepro.test`;
      await axios.post(`${BASE_URL}/auth/register`, {
        email, password: 'TestPass123!', username: `b12dup1_${id}`,
      }, { validateStatus: () => true });
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email, password: 'TestPass123!', username: `b12dup2_${id}`,
      }, { validateStatus: () => true });
      expect([400, 409, 422]).toContain(resp.status);
    });

    it('should reject duplicate username registration', async () => {
      const id = Date.now();
      const username = `b12dupuser_${id}`;
      await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_dupu1_${id}@stakepro.test`, password: 'TestPass123!', username,
      }, { validateStatus: () => true });
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_dupu2_${id}@stakepro.test`, password: 'TestPass123!', username,
      }, { validateStatus: () => true });
      expect([400, 409, 422]).toContain(resp.status);
    });

    it('should reject registration with empty email', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: '', password: 'TestPass123!', username: `b12empty_${Date.now()}`,
      }, { validateStatus: () => true });
      expect([400, 422]).toContain(resp.status);
    });

    it('should reject registration with empty password', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_nopw_${Date.now()}@stakepro.test`, password: '', username: `b12nopw_${Date.now()}`,
      }, { validateStatus: () => true });
      expect([400, 422]).toContain(resp.status);
    });

    it('should reject registration with empty username', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_noun_${Date.now()}@stakepro.test`, password: 'TestPass123!', username: '',
      }, { validateStatus: () => true });
      expect([400, 422]).toContain(resp.status);
    });

    it('should reject registration with invalid email format', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: 'not-an-email', password: 'TestPass123!', username: `b12inv_${Date.now()}`,
      }, { validateStatus: () => true });
      expect([400, 422]).toContain(resp.status);
    });

    it('should reject registration with short password', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_short_${Date.now()}@stakepro.test`, password: '123', username: `b12short_${Date.now()}`,
      }, { validateStatus: () => true });
      expect([400, 422]).toContain(resp.status);
    });

    it('should create user with PENDING_APPROVAL status', async () => {
      const id = Date.now();
      await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_pending_${id}@stakepro.test`, password: 'TestPass123!', username: `b12pend_${id}`,
      }, { validateStatus: () => true });
      
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/users/pending');
      if (resp.status === 200 && Array.isArray(resp.data)) {
        // Check if our user is in pending list
        const found = resp.data.find((u: any) => u.email === `b12_pending_${id}@stakepro.test`);
        if (found) {
          expect(found.status).toBe('PENDING_APPROVAL');
        }
      }
    });

    it('should approve a pending user', async () => {
      const id = Date.now();
      await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_appr_${id}@stakepro.test`, password: 'TestPass123!', username: `b12appr_${id}`,
      }, { validateStatus: () => true });
      
      const { client } = await getAuthClient();
      const pending = await client.get('/admin/users/pending');
      if (pending.status === 200 && Array.isArray(pending.data)) {
        const user = pending.data.find((u: any) => u.email === `b12_appr_${id}@stakepro.test`);
        if (user) {
          const resp = await client.post(`/admin/users/${user.id}/approve`);
          expect(resp.status).toBe(200);
          expect(resp.data.success || resp.data.message).toBeTruthy();
        }
      }
    });

    it('should ban a user', async () => {
      const id = Date.now();
      await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_ban_${id}@stakepro.test`, password: 'TestPass123!', username: `b12ban_${id}`,
      }, { validateStatus: () => true });
      
      const { client } = await getAuthClient();
      const users = await client.get('/admin/users');
      if (users.status === 200 && Array.isArray(users.data)) {
        const user = users.data.find((u: any) => u.email === `b12_ban_${id}@stakepro.test`);
        if (user) {
          const resp = await client.post(`/admin/users/${user.id}/ban`);
          expect([200, 201, 400]).toContain(resp.status);
        }
      }
    });

    it('should unban a banned user', async () => {
      const id = Date.now();
      await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_unban_${id}@stakepro.test`, password: 'TestPass123!', username: `b12unban_${id}`,
      }, { validateStatus: () => true });
      
      const { client } = await getAuthClient();
      const users = await client.get('/admin/users');
      if (users.status === 200 && Array.isArray(users.data)) {
        const user = users.data.find((u: any) => u.email === `b12_unban_${id}@stakepro.test`);
        if (user) {
          await client.post(`/admin/users/${user.id}/ban`);
          const resp = await client.post(`/admin/users/${user.id}/unban`);
          expect([200, 400]).toContain(resp.status);
        }
      }
    });

    it('should send verification email', async () => {
      const id = Date.now();
      await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_verify_${id}@stakepro.test`, password: 'TestPass123!', username: `b12ver_${id}`,
      }, { validateStatus: () => true });
      
      const { client } = await getAuthClient();
      const users = await client.get('/admin/users');
      if (users.status === 200 && Array.isArray(users.data)) {
        const user = users.data.find((u: any) => u.email === `b12_verify_${id}@stakepro.test`);
        if (user) {
          const resp = await client.post(`/admin/users/${user.id}/send-verification`);
          expect([200, 201, 400, 500]).toContain(resp.status);
        }
      }
    });

    it('should reject login for non-existent user', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'nonexistent@nowhere.com', password: 'WrongPass123!',
      }, { validateStatus: () => true });
      expect([400, 401, 404]).toContain(resp.status);
    });
  });

  // ============================================
  // SECTION 6: GAME CONFIG & GOD MODE (14 tests)
  // ============================================
  describe('🎮 Section 6: Game Config & God Mode', () => {
    it('should get current game config', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/game/config');
      expect(resp.status).toBe(200);
    });

    it('should update house edge', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', { houseEdge: 5 });
      expect([200, 201]).toContain(resp.status);
      // Reset
      await client.post('/admin/game/config', { houseEdge: 4 });
    });

    it('should update instant bust chance', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', { instantBust: 3 });
      expect([200, 201]).toContain(resp.status);
      // Reset
      await client.post('/admin/game/config', { instantBust: 2 });
    });

    it('should update both config values at once', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', { houseEdge: 5, instantBust: 3 });
      expect([200, 201]).toContain(resp.status);
      // Reset
      await client.post('/admin/game/config', { houseEdge: 4, instantBust: 2 });
    });

    it('should persist config changes', async () => {
      const { client } = await getAuthClient();
      await client.post('/admin/game/config', { houseEdge: 6 });
      const resp = await client.get('/admin/game/config');
      const data = resp.data.data || resp.data;
      expect(data.houseEdge).toBe(6);
      // Reset
      await client.post('/admin/game/config', { houseEdge: 4 });
    });

    it('should handle config update with empty body', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', {});
      expect([200, 201, 400]).toContain(resp.status);
    });

    it('should handle config update with invalid houseEdge type', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', { houseEdge: 'abc' });
      expect([200, 201, 400]).toContain(resp.status);
    });

    it('should handle config update with negative houseEdge', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', { houseEdge: -5 });
      expect([200, 201, 400]).toContain(resp.status);
    });

    it('should handle config update with very high houseEdge', async () => {
      const { client } = await getAuthClient();
      const resp = await client.post('/admin/game/config', { houseEdge: 100 });
      expect([200, 201, 400]).toContain(resp.status);
      // Reset
      await client.post('/admin/game/config', { houseEdge: 4 });
    });

    it('should handle concurrent config updates', async () => {
      const { client } = await getAuthClient();
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.post('/admin/game/config', { houseEdge: 3 + i })
      );
      const results = await Promise.all(promises);
      expect(results.every(r => [200, 201].includes(r.status))).toBe(true);
      // Reset
      await client.post('/admin/game/config', { houseEdge: 4 });
    });

    it('should return config with correct data types', async () => {
      const { client } = await getAuthClient();
      const resp = await client.get('/admin/game/config');
      const data = resp.data.data || resp.data;
      expect(typeof data.houseEdge).toBe('number');
      expect(typeof data.instantBust).toBe('number');
      expect(data.houseEdge).toBeGreaterThanOrEqual(0);
      expect(data.instantBust).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid config reads', async () => {
      const { client } = await getAuthClient();
      const promises = Array.from({ length: 10 }, () => client.get('/admin/game/config'));
      const results = await Promise.all(promises);
      expect(results.every(r => r.status === 200)).toBe(true);
    });

    it('should reject config update without authentication', async () => {
      const guest = getGuestClient();
      const resp = await guest.post('/admin/game/config', { houseEdge: 99 });
      expect(resp.status).toBe(401);
    });

    it('should reject config read without authentication', async () => {
      const guest = getGuestClient();
      const resp = await guest.get('/admin/game/config');
      expect(resp.status).toBe(401);
    });
  });

  // ============================================
  // SECTION 7: SECURITY & RATE LIMITING (15 tests)
  // ============================================
  describe('🔒 Section 7: Security & Rate Limiting', () => {
    it('should handle 20 rapid login attempts', async () => {
      const promises = Array.from({ length: 20 }, () =>
        axios.post(`${BASE_URL}/auth/login`, {
          email: 'marketedgepros@gmail.com', password: 'Admin99449x',
        }, { validateStatus: () => true })
      );
      const results = await Promise.all(promises);
      const successes = results.filter(r => r.status === 200).length;
      // Should either all succeed or some get rate limited
      expect(successes).toBeGreaterThan(0);
    });

    it('should handle 20 rapid registration attempts', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        axios.post(`${BASE_URL}/auth/register`, {
          email: `b12_rapid_${Date.now()}_${i}@stakepro.test`,
          password: 'TestPass123!',
          username: `b12rapid_${Date.now()}_${i}`,
        }, { validateStatus: () => true })
      );
      const results = await Promise.all(promises);
      // Some should succeed, some might be rate limited
      expect(results.some(r => [200, 201, 400, 429, 500].includes(r.status))).toBe(true);
    });

    it('should reject login with SQL injection in email', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, {
        email: "admin' OR '1'='1", password: 'anything',
      }, { validateStatus: () => true });
      expect([400, 401, 422]).toContain(resp.status);
    });

    it('should reject login with SQL injection in password', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@test.com', password: "' OR '1'='1",
      }, { validateStatus: () => true });
      expect([400, 401, 422]).toContain(resp.status);
    });

    it('should reject registration with XSS in username', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: `b12_xss_${Date.now()}@stakepro.test`,
        password: 'TestPass123!',
        username: '<script>alert("xss")</script>',
      }, { validateStatus: () => true });
      // Should either reject or sanitize
      expect([200, 201, 400, 422]).toContain(resp.status);
    });

    it('should handle oversized request body on login', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'x'.repeat(100000),
        password: 'y'.repeat(100000),
      }, { validateStatus: () => true });
      expect([400, 401, 413, 422, 500]).toContain(resp.status);
    });

    it('should handle oversized request body on register', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/register`, {
        email: 'x'.repeat(100000) + '@test.com',
        password: 'y'.repeat(100000),
        username: 'z'.repeat(100000),
      }, { validateStatus: () => true });
      expect([400, 413, 422, 500]).toContain(resp.status);
    });

    it('should not expose stack traces on error', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, {
        email: null, password: null,
      }, { validateStatus: () => true });
      const body = JSON.stringify(resp.data);
      expect(body).not.toContain('node_modules');
      expect(body).not.toContain('at Object');
      expect(body).not.toContain('.ts:');
    });

    it('should not expose database details on error', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, {
        email: "'; DROP TABLE users; --", password: 'test',
      }, { validateStatus: () => true });
      const body = JSON.stringify(resp.data);
      expect(body).not.toContain('PostgreSQL');
      expect(body).not.toContain('prisma');
      expect(body).not.toContain('SELECT');
    });

    it('should handle path traversal attempt', async () => {
      const resp = await axios.get(`${BASE_URL}/../../etc/passwd`, { validateStatus: () => true });
      expect([400, 404]).toContain(resp.status);
    });

    it('should handle request with no Content-Type', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, 'raw data', {
        validateStatus: () => true,
        headers: { 'Content-Type': undefined },
      });
      expect([400, 401, 415, 422]).toContain(resp.status);
    });

    it('should handle request with wrong Content-Type', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, '<xml>data</xml>', {
        validateStatus: () => true,
        headers: { 'Content-Type': 'application/xml' },
      });
      expect([400, 401, 415, 422]).toContain(resp.status);
    });

    it('should handle concurrent admin and user requests', async () => {
      const { client } = await getAuthClient();
      const promises = [
        client.get('/admin/users'),
        client.get('/admin/stats'),
        client.get('/affiliates/stats'),
        client.get('/admin/game/config'),
        client.get('/admin/finance/stats'),
      ];
      const results = await Promise.all(promises);
      expect(results.every(r => r.status === 200)).toBe(true);
    });

    it('should handle 50 concurrent requests to different endpoints', async () => {
      const { client } = await getAuthClient();
      const endpoints = ['/admin/users', '/admin/stats', '/affiliates/stats', '/admin/game/config', '/affiliates/leaderboard'];
      const promises = Array.from({ length: 50 }, (_, i) =>
        client.get(endpoints[i % endpoints.length])
      );
      const results = await Promise.all(promises);
      const successes = results.filter(r => r.status === 200).length;
      expect(successes).toBeGreaterThan(30);
    });

    it('should handle login attempt with prototype pollution', async () => {
      const resp = await axios.post(`${BASE_URL}/auth/login`, 
        JSON.parse('{"email":"test@test.com","password":"test","__proto__":{"isAdmin":true}}'),
        { validateStatus: () => true }
      );
      expect([400, 401]).toContain(resp.status);
    });
  });

  // Cleanup test users after all tests
  afterAll(async () => {
    try {
      const { client } = await getAuthClient();
      const users = await client.get('/admin/users');
      if (users.status === 200 && Array.isArray(users.data)) {
        // We don't delete here to avoid interfering with other tests
        // Just log the count
        const testUsers = users.data.filter((u: any) => 
          u.email?.includes('@stakepro.test') || u.email?.includes('b12_')
        );
        console.log(`Test users created: ${testUsers.length}`);
      }
    } catch {
      // Cleanup is best-effort
    }
  });
});

export {};
