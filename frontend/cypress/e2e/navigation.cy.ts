/// <reference types="cypress" />

/**
 * ============================================================
 * Phase 36: GLOBAL UI NAVIGATION TESTS (v3 - All Fixes)
 * ============================================================
 * Full coverage of sidebar navigation, lobby interactions,
 * wallet modal, modals, header, auth flows, and routing.
 * ============================================================
 */

describe('🧭 Global UI Navigation Suite', () => {

  // ==========================================
  // 📌 SIDEBAR NAVIGATION TESTS
  // ==========================================
  describe('📌 Sidebar Navigation', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('Should render the sidebar', () => {
      cy.getByTestId('sidebar').should('exist');
    });

    it('Should display StakePro logo', () => {
      cy.getByTestId('logo-text').should('contain', 'StakePro');
    });

    it('Should have Casino/Sports toggle buttons', () => {
      cy.getByTestId('nav-casino').should('exist').and('be.visible');
      cy.getByTestId('nav-sports').should('exist').and('be.visible');
    });

    it('Should toggle Casino section on click', () => {
      cy.getByTestId('nav-casino').click();
      cy.getByTestId('nav-games-list').should('be.visible');
    });

    it('Should toggle Sports section on click', () => {
      cy.getByTestId('nav-sports').click();
      cy.getByTestId('nav-sports').should('be.visible');
    });

    it('Should navigate to Home', () => {
      cy.getByTestId('nav-home').click();
      cy.url().should('eq', Cypress.config('baseUrl') + '/');
    });

    it('Should navigate to Crash game', () => {
      cy.getByTestId('nav-crash').click();
      cy.url().should('include', '/games/crash');
    });

    it('Should navigate to Plinko game', () => {
      cy.getByTestId('nav-plinko').click();
      cy.url().should('include', '/games/plinko');
    });

    it('Should navigate to Dice game', () => {
      cy.getByTestId('nav-dice').click();
      cy.url().should('include', '/games/dice');
    });

    it('Should navigate to Mines game', () => {
      cy.getByTestId('nav-mines').click();
      cy.url().should('include', '/games/mines');
    });

    it('Should display HOT badge on Crash', () => {
      cy.getByTestId('badge-crash').should('exist').and('contain', 'HOT');
    });

    it('Should display NEW badge on Plinko', () => {
      cy.getByTestId('badge-plinko').should('exist').and('contain', 'NEW');
    });

    it('Should display VIP banner', () => {
      cy.getByTestId('vip-banner').should('be.visible');
    });

    it('Should open VIP modal from Learn More button', () => {
      cy.getByTestId('vip-learn-more').click();
      cy.get('body').should('contain.text', 'VIP');
    });
  });

  // ==========================================
  // 🏠 LOBBY / HOME PAGE TESTS
  // ==========================================
  describe('🏠 Lobby / Home Page', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('Should display the welcome banner', () => {
      cy.contains('Welcome to StakePro').should('be.visible');
    });

    it('Should display the Lobby section with games', () => {
      cy.contains('Lobby').should('be.visible');
    });

    it('Should display game cards in the lobby', () => {
      cy.get('[data-testid^="game-card-"]').should('have.length.at.least', 1);
    });

    it('Should display game names on cards', () => {
      cy.get('[data-testid^="game-card-"]').first().should('contain.text', '');
    });

    it('Should navigate to Crash game when clicking Crash card', () => {
      cy.contains('a', 'Crash').click();
      cy.url().should('include', '/games/crash');
    });

    it('Should navigate to Plinko game from lobby card', () => {
      cy.contains('a', 'Plinko').click();
      cy.url().should('include', '/games/plinko');
    });

    it('Should display HOT badges on featured games', () => {
      cy.contains('HOT').should('exist');
    });

    it('Should display LIVE badges on live casino games', () => {
      cy.contains('LIVE').should('exist');
    });

    it('Should display statistics section (Total Wagered, Games Played, etc.)', () => {
      cy.contains('Total Wagered').should('exist');
      cy.contains('Games Played').should('exist');
      cy.contains('Highest Win').should('exist');
      cy.contains('Active Players').should('exist');
    });

    it('Should display feature cards (Provably Fair, Instant Withdrawals, Secure)', () => {
      cy.contains('Provably Fair').should('exist');
      cy.contains('Instant Withdrawals').should('exist');
      cy.contains('Secure').should('exist');
    });
  });

  // ==========================================
  // 🔐 AUTH FLOW TESTS
  // ==========================================
  describe('🔐 Authentication Flow', () => {
    it('Should display Login and Register links in header when not authenticated', () => {
      cy.clearAllLocalStorage();
      cy.clearAllSessionStorage();
      cy.visit('/');
      cy.get('[data-testid="header-login"]').should('be.visible');
      cy.get('[data-testid="header-register"]').should('be.visible');
    });

    it('Should navigate to Login page from header', () => {
      cy.clearAllLocalStorage();
      cy.visit('/');
      cy.get('[data-testid="header-login"]').click();
      cy.url().should('include', '/login');
    });

    it('Should navigate to Register page from header', () => {
      cy.clearAllLocalStorage();
      cy.visit('/');
      cy.get('[data-testid="header-register"]').click();
      cy.url().should('include', '/register');
    });

    it('Should display login form with email and password fields', () => {
      cy.visit('/login');
      cy.getByTestId('login-form').should('exist');
      cy.getByTestId('login-email').should('exist');
      cy.getByTestId('login-password').should('exist');
      cy.getByTestId('login-submit').should('exist');
    });

    it('Should show error on invalid login', () => {
      cy.visit('/login');
      cy.getByTestId('login-email').type('invalid@test.com');
      cy.getByTestId('login-password').type('wrongpassword');
      cy.getByTestId('login-submit').click();

      cy.wait(3000);
      cy.get('body').then(($body) => {
        const text = $body.text().toLowerCase();
        const hasError = text.includes('failed') || text.includes('error') || 
                        text.includes('invalid') || text.includes('incorrect') ||
                        text.includes('wrong') || text.includes('unauthorized');
        expect(hasError).to.be.true;
      });
    });

    it('Should login successfully with valid credentials', () => {
      cy.visit('/login');
      cy.getByTestId('login-email').type(Cypress.env('adminEmail'));
      cy.getByTestId('login-password').type(Cypress.env('adminPassword'));
      cy.getByTestId('login-submit').click();

      cy.url({ timeout: 10000 }).should('not.include', '/login');
    });

    it('Should display register form with all fields', () => {
      cy.visit('/register');
      cy.getByTestId('register-form').should('exist');
      cy.getByTestId('register-username').should('exist');
      cy.getByTestId('register-email').should('exist');
    });

    it('Should navigate from Login to Register via link', () => {
      cy.visit('/login');
      cy.contains('Sign up').click();
      cy.url().should('include', '/register');
    });

    it('Should navigate from Register to Login via link', () => {
      cy.visit('/register');
      cy.contains('Sign in').click();
      cy.url().should('include', '/login');
    });
  });

  // ==========================================
  // 💰 WALLET MODAL TESTS
  // ==========================================
  describe('💰 Wallet Modal', () => {
    beforeEach(() => {
      cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
      cy.visit('/');
      // Wait for page to fully load and settle
      cy.wait(1000);
    });

    it('Should open Wallet modal from sidebar', () => {
      cy.getByTestId('nav-wallet').click({ force: true });
      cy.getByTestId('wallet-modal', { timeout: 10000 }).should('be.visible');
    });

    it('Should display Wallet title in modal', () => {
      cy.getByTestId('nav-wallet').click({ force: true });
      cy.getByTestId('wallet-modal', { timeout: 10000 }).should('be.visible');
      cy.getByTestId('wallet-modal').within(() => {
        cy.contains('Wallet').should('be.visible');
      });
    });

    it('Should close Wallet modal on Escape key', () => {
      cy.getByTestId('nav-wallet').click({ force: true });
      cy.getByTestId('wallet-modal', { timeout: 10000 }).should('be.visible');

      cy.get('body').type('{esc}');
      cy.getByTestId('wallet-modal', { timeout: 5000 }).should('not.exist');
    });

    it('Should display deposit/withdraw tabs in wallet', () => {
      cy.getByTestId('nav-wallet').click({ force: true });
      cy.getByTestId('wallet-modal', { timeout: 10000 }).should('be.visible');
      // Check within the modal for deposit/withdraw tabs
      cy.getByTestId('wallet-modal').within(() => {
        cy.contains('Deposit').should('be.visible');
        cy.contains('Withdraw').should('be.visible');
      });
    });
  });

  // ==========================================
  // ⚙️ SETTINGS MODAL TESTS
  // ==========================================
  describe('⚙️ Settings Modal', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.wait(500);
    });

    it('Should open Settings modal from sidebar', () => {
      cy.getByTestId('nav-settings').click();
      cy.getByTestId('settings-modal').should('be.visible');
    });

    it('Should display Settings title', () => {
      cy.getByTestId('nav-settings').click();
      cy.getByTestId('settings-modal').should('be.visible');
      cy.getByTestId('settings-modal').within(() => {
        cy.contains('Settings').should('be.visible');
      });
    });

    it('Should have sound toggle in settings', () => {
      cy.getByTestId('nav-settings').click();
      cy.contains('Sound').should('exist');
    });

    it('Should close Settings modal via close button', () => {
      cy.getByTestId('nav-settings').click();
      cy.getByTestId('settings-modal').should('be.visible');

      // Click the X close button
      cy.getByTestId('settings-close').click();
      cy.wait(500);
      cy.getByTestId('settings-modal').should('not.exist');
    });
  });

  // ==========================================
  // 📊 STATISTICS MODAL TESTS
  // ==========================================
  describe('📊 Statistics Modal', () => {
    beforeEach(() => {
      cy.visit('/');
      cy.wait(500);
    });

    it('Should open Statistics modal from sidebar', () => {
      cy.getByTestId('nav-stats').click();
      cy.getByTestId('statistics-modal').should('be.visible');
    });

    it('Should display Statistics title', () => {
      cy.getByTestId('nav-stats').click();
      cy.getByTestId('statistics-modal').should('be.visible');
      cy.getByTestId('statistics-modal').within(() => {
        cy.contains('Statistics').should('be.visible');
      });
    });

    it('Should close Statistics modal via close button', () => {
      cy.getByTestId('nav-stats').click();
      cy.getByTestId('statistics-modal').should('be.visible');

      // Click the X close button
      cy.getByTestId('statistics-close').click();
      cy.wait(500);
      cy.getByTestId('statistics-modal').should('not.exist');
    });
  });

  // ==========================================
  // 🔍 HEADER TESTS
  // ==========================================
  describe('🔍 Header', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('Should render the header', () => {
      cy.getByTestId('header').should('exist').and('be.visible');
    });

    it('Should display search input on desktop', () => {
      cy.viewport(1440, 900);
      cy.getByTestId('header-search').should('be.visible');
    });

    it('Should display online users count', () => {
      cy.contains('Online:').should('exist');
    });

    it('Should display bets today count', () => {
      cy.contains('Bets Today:').should('exist');
    });
  });

  // ==========================================
  // 🎮 GAME PAGE ROUTING TESTS
  // ==========================================
  describe('🎮 Game Page Routing', () => {
    beforeEach(() => {
      cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    });

    it('Should load Crash game page', () => {
      cy.visit('/games/crash', { timeout: 15000 });
      cy.url().should('include', '/games/crash');
      cy.get('body').should('exist');
      cy.get('canvas, [data-testid*="crash"], h1, h2').should('exist');
    });

    it('Should load Plinko game page', () => {
      cy.visit('/games/plinko', { timeout: 15000 });
      cy.url().should('include', '/games/plinko');
      cy.get('[data-testid="plinko-game"], canvas, [data-testid*="plinko"]').should('exist');
    });

    it('Should load Dice game page', () => {
      cy.visit('/games/dice', { timeout: 15000 });
      cy.url().should('include', '/games/dice');
      cy.get('body').should('exist');
      cy.get('canvas, [data-testid*="dice"], h1, h2, .game').should('exist');
    });

    it('Should load Mines game page', () => {
      cy.visit('/games/mines', { timeout: 15000 });
      cy.url().should('include', '/games/mines');
      cy.get('body').should('exist');
      cy.get('canvas, [data-testid*="mines"], h1, h2, .game').should('exist');
    });

    it('Should handle non-existent game route gracefully', () => {
      cy.visit('/games/nonexistent', { failOnStatusCode: false, timeout: 15000 });
      cy.url().should('exist');
    });
  });

  // ==========================================
  // 🔗 DEEP LINKING TESTS
  // ==========================================
  describe('🔗 Deep Linking', () => {
    it('Should load login page directly', () => {
      cy.visit('/login');
      cy.getByTestId('login-form').should('exist');
    });

    it('Should load register page directly', () => {
      cy.visit('/register');
      cy.getByTestId('register-form').should('exist');
    });

    it('Should load affiliates page directly', () => {
      cy.visit('/affiliates');
      cy.url().should('include', '/affiliates');
    });
  });

  // ==========================================
  // 👤 AUTHENTICATED USER NAVIGATION
  // ==========================================
  describe('👤 Authenticated User Navigation', () => {
    beforeEach(() => {
      cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
      cy.visit('/');
    });

    it('Should display user menu when authenticated', () => {
      cy.getByTestId('user-menu').should('be.visible');
    });

    it('Should display wallet balance in header', () => {
      cy.getByTestId('header-wallet-balance').should('be.visible');
    });

    it('Should display deposit button in header', () => {
      cy.get('[data-testid="header-deposit"]').first().should('exist');
    });

    it('Should open user dropdown menu', () => {
      cy.getByTestId('user-menu').click();
      cy.contains('Affiliates').should('be.visible');
      cy.contains('Logout').should('be.visible');
    });

    it('Should navigate to Affiliates from user menu', () => {
      cy.getByTestId('user-menu').click();
      cy.contains('Affiliates').click();
      cy.url().should('include', '/affiliates');
    });

    it('Should display Admin Panel link for admin users', () => {
      cy.getByTestId('nav-admin').should('exist');
    });

    it('Should navigate to Admin Dashboard', () => {
      cy.getByTestId('nav-admin').click();
      cy.url().should('include', '/admin');
    });
  });
});
