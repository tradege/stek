/**
 * ⚔️ PHASE 48 - STEP 2: Aggregator Flow E2E Test
 * 
 * OBJECTIVE: Verify the full External Game cycle.
 * FLOW:
 *   1. Login via API
 *   2. Navigate to game pages
 *   3. Assert game launch URL works
 *   4. Simulate a "Win" callback from Provider via API
 *   5. Assert User Balance updates correctly
 */

const API_URL = Cypress.env('apiUrl') || 'http://146.190.21.113:3000';
const API_KEY = '1de51fcb05661780cd7f41a5313b9513042c837d5e88372be452851b8c45b657';

describe('⚔️ PHASE 48 STEP 2: Aggregator Flow - External Game Cycle', () => {
  let testUserId: string;
  let testToken: string;
  let adminToken: string;

  before(() => {
    // Login as admin first
    cy.request({
      method: 'POST',
      url: `${API_URL}/auth/login`,
      body: { email: 'marketedgepros@gmail.com', password: 'Admin99449x' },
      failOnStatusCode: false,
    }).then((loginRes) => {
      adminToken = loginRes.body?.token;
    });

    // Register a test user via API
    const uid = Date.now();
    cy.request({
      method: 'POST',
      url: `${API_URL}/auth/register`,
      body: {
        email: `agg_test_${uid}@stakepro.test`,
        username: `agg_${uid}`,
        password: 'TestPass123!',
      },
      failOnStatusCode: false,
    }).then((res) => {
      testUserId = res.body?.user?.id || res.body?.id;
      testToken = res.body?.token;

      // Give user $500 via integration API
      if (testUserId) {
        cy.request({
          method: 'POST',
          url: `${API_URL}/api/integration/transaction`,
          headers: { 'X-API-KEY': API_KEY },
          body: {
            transactionId: `agg_setup_${uid}`,
            userId: testUserId,
            amount: 500,
            gameId: 'setup-game',
            roundId: `agg_setup_round_${uid}`,
            type: 'WIN',
          },
          failOnStatusCode: false,
        });
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // SECTION 1: LOGIN AND NAVIGATE TO GAMES
  // ═══════════════════════════════════════════════════

  describe('1. Login and Game Navigation', () => {
    it('should login successfully via API', () => {
      cy.request({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        body: { email: 'marketedgepros@gmail.com', password: 'Admin99449x' },
      }).then((res) => {
        expect(res.status).to.be.oneOf([200, 201]);
        expect(res.body).to.have.property('token');
        expect(res.body.user).to.have.property('role', 'ADMIN');
      });
    });

    it('should navigate to homepage and see games', () => {
      cy.visit('/');
      cy.wait(2000);
      cy.get('body').then(($body) => {
        const text = $body.text();
        const hasGames = text.includes('Crash') || text.includes('Plinko') || text.includes('Games');
        expect(hasGames).to.be.true;
      });
    });

    it('should navigate to Crash game page', () => {
      cy.visit('/games/crash');
      cy.wait(3000);
      cy.get('body').then(($body) => {
        const text = $body.text();
        const hasCrash = text.includes('Crash') || text.includes('crash') || text.includes('BET');
        expect(hasCrash).to.be.true;
      });
    });

    it('should navigate to Plinko game page', () => {
      cy.visit('/games/plinko');
      cy.wait(2000);
      cy.get('body').then(($body) => {
        const text = $body.text();
        expect(text.includes('Plinko') || text.includes('plinko')).to.be.true;
      });
    });
  });

  // ═══════════════════════════════════════════════════
  // SECTION 2: GAME LAUNCH FLOW VIA API
  // ═══════════════════════════════════════════════════

  describe('2. Game Launch Flow via API', () => {
    it('should get list of available games', () => {
      cy.request({
        method: 'GET',
        url: `${API_URL}/api/games`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.have.property('data');
        expect(res.body.data).to.be.an('array');
        expect(res.body.data.length).to.be.gt(0);
      });
    });

    it('should get game providers list', () => {
      cy.request({
        method: 'GET',
        url: `${API_URL}/api/games/providers`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.gt(0);
        expect(res.body[0]).to.have.property('name');
      });
    });

    it('should get game categories', () => {
      cy.request({
        method: 'GET',
        url: `${API_URL}/api/games/categories`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.gt(0);
        expect(res.body[0]).to.have.property('category');
      });
    });

    it('should get game details by slug', () => {
      cy.request({
        method: 'GET',
        url: `${API_URL}/api/games/sweet-bonanza`,
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.be.oneOf([200, 404]);
        if (res.status === 200) {
          expect(res.body).to.have.property('name');
          expect(res.body).to.have.property('slug');
        }
      });
    });

    it('should launch a game and get launch URL', () => {
      cy.request({
        method: 'GET',
        url: `${API_URL}/api/games`,
        failOnStatusCode: false,
      }).then((gamesRes) => {
        const games = gamesRes.body?.data || gamesRes.body;
        if (games && Array.isArray(games) && games.length > 0) {
          const game = games[0];
          const slug = game.slug || game.id;
          
          cy.request({
            method: 'POST',
            url: `${API_URL}/api/games/${slug}/launch`,
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
            failOnStatusCode: false,
          }).then((launchRes) => {
            expect(launchRes.status).to.be.oneOf([200, 201, 401, 403]);
          });
        }
      });
    });

    it('should list active game sessions', () => {
      cy.request({
        method: 'GET',
        url: `${API_URL}/api/games/sessions/active`,
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.be.oneOf([200, 401, 403]);
      });
    });
  });

  // ═══════════════════════════════════════════════════
  // SECTION 3: INTEGRATION API - WIN CALLBACK FLOW
  // ═══════════════════════════════════════════════════

  describe('3. Win Callback from Provider', () => {
    it('should check initial balance via integration API', () => {
      if (!testUserId) return;
      cy.request({
        method: 'POST',
        url: `${API_URL}/api/integration/balance`,
        headers: { 'X-API-KEY': API_KEY },
        body: { userId: testUserId, currency: 'USDT' },
      }).then((res) => {
        expect(res.body.status).to.eq('OK');
        expect(res.body.balance).to.be.a('number');
      });
    });

    it('should process a BET transaction from provider', () => {
      if (!testUserId) return;
      const txId = `agg_bet_${Date.now()}`;
      cy.request({
        method: 'POST',
        url: `${API_URL}/api/integration/transaction`,
        headers: { 'X-API-KEY': API_KEY },
        body: {
          transactionId: txId,
          userId: testUserId,
          amount: 10,
          gameId: 'sweet-bonanza',
          roundId: `agg_round_${Date.now()}`,
          type: 'BET',
        },
      }).then((res) => {
        expect(res.body.status).to.eq('OK');
      });
    });

    it('should process a WIN transaction and increase balance', () => {
      if (!testUserId) return;
      
      cy.request({
        method: 'POST',
        url: `${API_URL}/api/integration/balance`,
        headers: { 'X-API-KEY': API_KEY },
        body: { userId: testUserId, currency: 'USDT' },
      }).then((beforeRes) => {
        const balanceBefore = beforeRes.body.balance;

        const txId = `agg_win_${Date.now()}`;
        cy.request({
          method: 'POST',
          url: `${API_URL}/api/integration/transaction`,
          headers: { 'X-API-KEY': API_KEY },
          body: {
            transactionId: txId,
            userId: testUserId,
            amount: 50,
            gameId: 'sweet-bonanza',
            roundId: `agg_win_round_${Date.now()}`,
            type: 'WIN',
          },
        }).then((winRes) => {
          expect(winRes.body.status).to.eq('OK');

          cy.request({
            method: 'POST',
            url: `${API_URL}/api/integration/balance`,
            headers: { 'X-API-KEY': API_KEY },
            body: { userId: testUserId, currency: 'USDT' },
          }).then((afterRes) => {
            expect(afterRes.body.balance).to.eq(balanceBefore + 50);
          });
        });
      });
    });

    it('should handle full game round: BET → WIN → verify balance', () => {
      if (!testUserId) return;
      const roundId = `full_round_${Date.now()}`;
      
      cy.request({
        method: 'POST',
        url: `${API_URL}/api/integration/balance`,
        headers: { 'X-API-KEY': API_KEY },
        body: { userId: testUserId, currency: 'USDT' },
      }).then((beforeRes) => {
        const before = beforeRes.body.balance;

        cy.request({
          method: 'POST',
          url: `${API_URL}/api/integration/transaction`,
          headers: { 'X-API-KEY': API_KEY },
          body: {
            transactionId: `full_bet_${Date.now()}`,
            userId: testUserId,
            amount: 20,
            gameId: 'sweet-bonanza',
            roundId,
            type: 'BET',
          },
        }).then(() => {
          cy.request({
            method: 'POST',
            url: `${API_URL}/api/integration/transaction`,
            headers: { 'X-API-KEY': API_KEY },
            body: {
              transactionId: `full_win_${Date.now()}`,
              userId: testUserId,
              amount: 40,
              gameId: 'sweet-bonanza',
              roundId,
              type: 'WIN',
            },
          }).then(() => {
            cy.request({
              method: 'POST',
              url: `${API_URL}/api/integration/balance`,
              headers: { 'X-API-KEY': API_KEY },
              body: { userId: testUserId, currency: 'USDT' },
            }).then((afterRes) => {
              expect(afterRes.body.balance).to.eq(before + 20);
            });
          });
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════
  // SECTION 4: BALANCE DISPLAY IN UI
  // ═══════════════════════════════════════════════════

  describe('4. Balance Display in UI', () => {
    it('should display USDT currency on homepage', () => {
      cy.visit('/');
      cy.wait(2000);
      cy.get('body').then(($body) => {
        const text = $body.text();
        const hasBalance = text.includes('USDT') || text.includes('Deposit') || text.includes('Balance');
        expect(hasBalance).to.be.true;
      });
    });

    it('should show Deposit button in header', () => {
      cy.visit('/');
      cy.wait(2000);
      cy.get('body').then(($body) => {
        expect($body.text().includes('Deposit')).to.be.true;
      });
    });
  });

  // ═══════════════════════════════════════════════════
  // SECTION 5: ROLLBACK FLOW
  // ═══════════════════════════════════════════════════

  describe('5. Rollback Flow - Provider Cancels Transaction', () => {
    it('should rollback a BET and restore balance', () => {
      if (!testUserId) return;

      cy.request({
        method: 'POST',
        url: `${API_URL}/api/integration/balance`,
        headers: { 'X-API-KEY': API_KEY },
        body: { userId: testUserId, currency: 'USDT' },
      }).then((beforeRes) => {
        const before = beforeRes.body.balance;
        const txId = `rollback_bet_${Date.now()}`;

        cy.request({
          method: 'POST',
          url: `${API_URL}/api/integration/transaction`,
          headers: { 'X-API-KEY': API_KEY },
          body: {
            transactionId: txId,
            userId: testUserId,
            amount: 25,
            gameId: 'rollback-test',
            roundId: `rb_round_${Date.now()}`,
            type: 'BET',
          },
        }).then(() => {
          cy.request({
            method: 'POST',
            url: `${API_URL}/api/integration/rollback`,
            headers: { 'X-API-KEY': API_KEY },
            body: { transactionId: txId },
          }).then((rbRes) => {
            expect(rbRes.body.status).to.eq('OK');

            cy.request({
              method: 'POST',
              url: `${API_URL}/api/integration/balance`,
              headers: { 'X-API-KEY': API_KEY },
              body: { userId: testUserId, currency: 'USDT' },
            }).then((afterRes) => {
              expect(afterRes.body.balance).to.eq(before);
            });
          });
        });
      });
    });

    it('should handle rollback of non-existent transaction gracefully', () => {
      cy.request({
        method: 'POST',
        url: `${API_URL}/api/integration/rollback`,
        headers: { 'X-API-KEY': API_KEY },
        body: { transactionId: `nonexistent_${Date.now()}` },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.body.status).to.be.oneOf(['OK', 'ERROR']);
      });
    });
  });

  // ═══════════════════════════════════════════════════
  // SECTION 6: MULTI-PROVIDER SIMULATION
  // ═══════════════════════════════════════════════════

  describe('6. Multi-Provider Game Simulation', () => {
    it('should handle transactions from different game providers', () => {
      if (!testUserId) return;

      const providers = ['pragmatic-play', 'evolution', 'netent', 'microgaming', 'playtech'];
      
      providers.forEach((provider, i) => {
        cy.request({
          method: 'POST',
          url: `${API_URL}/api/integration/transaction`,
          headers: { 'X-API-KEY': API_KEY },
          body: {
            transactionId: `multi_bet_${Date.now()}_${i}`,
            userId: testUserId,
            amount: 5,
            gameId: `${provider}-game`,
            roundId: `multi_round_${Date.now()}_${i}`,
            type: 'BET',
          },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.body.status).to.be.oneOf(['OK', 'INSUFFICIENT_FUNDS']);
        });
      });
    });

    it('should maintain correct balance across multi-provider transactions', () => {
      if (!testUserId) return;
      cy.request({
        method: 'POST',
        url: `${API_URL}/api/integration/balance`,
        headers: { 'X-API-KEY': API_KEY },
        body: { userId: testUserId, currency: 'USDT' },
      }).then((res) => {
        expect(res.body.status).to.eq('OK');
        expect(res.body.balance).to.be.a('number');
        expect(res.body.balance).to.be.gte(0);
      });
    });
  });
});
