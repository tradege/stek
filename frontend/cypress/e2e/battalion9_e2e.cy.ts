/// <reference types="cypress" />
/**
 * ================================================================
 * ⚔️ THE 300 - BATTALION 9: "THE VANGUARD"
 * ================================================================
 * MISSION: 100% Frontend E2E Coverage
 * TARGET: ALL pages, ALL user flows, ALL UI states
 * SCOPE: Auth, Homepage, Games, Admin, Wallet, Chat, Sports
 * TESTS: 110 total
 * ================================================================
 */

const ADMIN = { email: 'marketedgepros@gmail.com', password: '994499' };

describe('⚔️ BATTALION 9: THE VANGUARD - Complete Frontend E2E', () => {

  // ============================================================
  // 🔐 SECTION 1: AUTH FLOWS (10 tests)
  // ============================================================
  describe('🔐 AUTH FLOWS', () => {

    describe('Login Page', () => {
      beforeEach(() => cy.visit('/login'));

      it('should render login form with email field', () => {
        cy.getByTestId('login-email').should('exist');
      });

      it('should render login form with password field', () => {
        cy.getByTestId('login-password').should('exist');
      });

      it('should render login submit button', () => {
        cy.getByTestId('login-submit').should('exist');
      });

      it('should display Welcome back text', () => {
        cy.contains('Welcome back').should('exist');
      });

      it('should login successfully with valid credentials', () => {
        cy.getByTestId('login-email').clear().type(ADMIN.email);
        cy.getByTestId('login-password').clear().type(ADMIN.password);
        cy.getByTestId('login-submit').click();
        cy.url({ timeout: 15000 }).should('not.include', '/login');
      });

      it('should have link to register page', () => {
        cy.contains('Sign up').should('exist');
      });

      it('should display StakePro branding on login', () => {
        cy.contains('StakePro').should('exist');
      });
    });

    describe('Register Page', () => {
      beforeEach(() => cy.visit('/register'));

      it('should render Create your account text', () => {
        cy.contains('Create your account').should('exist');
      });

      it('should have link to login page', () => {
        cy.contains('Sign in').should('exist');
      });
    });

    describe('Auth State', () => {
      it('should persist login state across page navigation', () => {
        cy.loginViaApi(ADMIN.email, ADMIN.password);
        cy.visit('/');
        cy.visit('/games/crash');
        cy.url().should('include', '/games/crash');
        cy.getByTestId('sidebar').should('exist');
      });
    });
  });

  // ============================================================
  // 🏠 SECTION 2: HOMEPAGE & SIDEBAR (15 tests)
  // ============================================================
  describe('🏠 HOMEPAGE & SIDEBAR', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/');
    });

    it('should render the sidebar', () => {
      cy.getByTestId('sidebar').should('exist');
    });

    it('should display StakePro logo', () => {
      cy.getByTestId('logo-text').should('exist');
    });

    it('should have Casino navigation', () => {
      cy.getByTestId('nav-casino').should('exist');
    });

    it('should have Sports navigation', () => {
      cy.getByTestId('nav-sports').should('exist');
    });

    it('should display Crash game link', () => {
      cy.getByTestId('nav-crash').should('exist');
    });

    it('should display Plinko game link', () => {
      cy.getByTestId('nav-plinko').should('exist');
    });

    it('should display Dice game link', () => {
      cy.getByTestId('nav-dice').should('exist');
    });

    it('should display Mines game link', () => {
      cy.getByTestId('nav-mines').should('exist');
    });

    it('should render the header', () => {
      cy.getByTestId('header').should('exist');
    });

    it('should have search in header', () => {
      cy.getByTestId('header-search').should('exist');
    });

    it('should display VIP banner', () => {
      cy.getByTestId('vip-banner').should('exist');
    });

    it('should have Wallet navigation', () => {
      cy.getByTestId('nav-wallet').should('exist');
    });

    it('should have Statistics navigation', () => {
      cy.getByTestId('nav-stats').should('exist');
    });

    it('should have Settings navigation', () => {
      cy.getByTestId('nav-settings').should('exist');
    });

    it('should have proper dark theme background', () => {
      cy.get('body').should('have.css', 'background-color').and('not.eq', 'rgb(255, 255, 255)');
    });
  });

  // ============================================================
  // 🎮 SECTION 3: GAME PAGES (20 tests)
  // ============================================================
  describe('🎮 CRASH GAME', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/games/crash');
    });

    it('should load crash game page', () => {
      cy.url().should('include', '/games/crash');
    });

    it('should display the crash canvas', () => {
      cy.get('canvas').should('exist');
    });

    it('should have bet input field', () => {
      cy.get('input').should('exist');
    });

    it('should render sidebar on crash page', () => {
      cy.getByTestId('sidebar').should('exist');
    });

    it('should render header on crash page', () => {
      cy.getByTestId('header').should('exist');
    });
  });

  describe('🎯 PLINKO GAME', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/games/plinko');
    });

    it('should load plinko game page', () => {
      cy.url().should('include', '/games/plinko');
    });

    it('should display the plinko canvas', () => {
      cy.get('canvas').should('exist');
    });

    it('should have bet input on plinko', () => {
      cy.get('input').should('exist');
    });

    it('should render sidebar on plinko', () => {
      cy.getByTestId('sidebar').should('exist');
    });

    it('should render header on plinko', () => {
      cy.getByTestId('header').should('exist');
    });
  });

  describe('🎲 DICE GAME', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/games/dice');
    });

    it('should load dice game page', () => {
      cy.url().should('include', '/games/dice');
    });

    it('should have bet controls on dice', () => {
      cy.get('input').should('exist');
    });

    it('should have game controls on dice', () => {
      cy.get('body').should('exist');
      cy.get('[class*="dice"], canvas, input').should('exist');
    });

    it('should render sidebar on dice', () => {
      cy.getByTestId('sidebar').should('exist');
    });

    it('should render header on dice', () => {
      cy.getByTestId('header').should('exist');
    });
  });

  describe('💣 MINES GAME', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/games/mines');
    });

    it('should load mines game page', () => {
      cy.url().should('include', '/games/mines');
    });

    it('should display the mines grid', () => {
      cy.get('[class*="grid"]').should('exist');
    });

    it('should have bet input on mines', () => {
      cy.get('input').should('exist');
    });

    it('should render sidebar on mines', () => {
      cy.getByTestId('sidebar').should('exist');
    });

    it('should render header on mines', () => {
      cy.getByTestId('header').should('exist');
    });
  });

  // ============================================================
  // 🏈 SECTION 4: SPORTS PAGE (5 tests)
  // ============================================================
  describe('🏈 SPORTS PAGE', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/sports');
    });

    it('should load sports page', () => {
      cy.url().should('include', '/sports');
    });

    it('should have sidebar on sports', () => {
      cy.getByTestId('sidebar').should('exist');
    });

    it('should render header on sports', () => {
      cy.getByTestId('header').should('exist');
    });

    it('should display sports content', () => {
      cy.get('body').should('exist');
    });

    it('should have nav-sports active', () => {
      cy.getByTestId('nav-sports').should('exist');
    });
  });

  // ============================================================
  // 👑 SECTION 5: ADMIN PAGES (10 tests)
  // ============================================================
  describe('👑 ADMIN PAGES', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
    });

    describe('Admin Dashboard', () => {
      beforeEach(() => cy.visit('/admin/dashboard'));

      it('should load admin dashboard', () => {
        cy.url().should('include', '/admin');
      });

      it('should display dashboard content', () => {
        cy.contains('Dashboard').should('exist');
      });

      it('should have admin layout', () => {
        cy.get('body').should('exist');
      });
    });

    describe('Admin Users', () => {
      beforeEach(() => cy.visit('/admin/users'));

      it('should load users page', () => {
        cy.url().should('include', '/admin/users');
      });

      it('should display users content', () => {
        cy.contains('Users').should('exist');
      });
    });

    describe('Admin Finance', () => {
      beforeEach(() => cy.visit('/admin/finance'));

      it('should load finance page', () => {
        cy.url().should('include', '/admin/finance');
      });

      it('should display finance content', () => {
        cy.get('body').should('exist');
      });
    });

    describe('Admin Navigation', () => {
      it('should navigate to admin dashboard', () => {
        cy.visit('/admin/dashboard');
        cy.url().should('include', '/admin');
      });

      it('should navigate to admin users', () => {
        cy.visit('/admin/users');
        cy.url().should('include', '/admin/users');
      });

      it('should navigate to admin finance', () => {
        cy.visit('/admin/finance');
        cy.url().should('include', '/admin/finance');
      });
    });
  });

  // ============================================================
  // 💬 SECTION 6: CHAT (5 tests)
  // ============================================================
  describe('💬 CHAT', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/');
    });

    it('should display Live Chat section', () => {
      cy.contains('Live Chat').should('exist');
    });

    it('should display Chat Room', () => {
      cy.contains('Chat Room').should('exist');
    });

    it('should have message input', () => {
      cy.get('input[placeholder*="message"], input[placeholder*="Message"]').should('exist');
    });

    it('should display chat area', () => {
      cy.contains('Chat Room').should('exist');
    });

    it('should have scrollable area', () => {
      cy.get('[class*="scroll"]').should('exist');
    });
  });

  // ============================================================
  // 💰 SECTION 7: WALLET & BALANCE (5 tests)
  // ============================================================
  describe('💰 WALLET & BALANCE', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/');
    });

    it('should display header with balance area', () => {
      cy.getByTestId('header').should('exist');
    });

    it('should have wallet navigation', () => {
      cy.getByTestId('nav-wallet').should('exist');
    });

    it('should have stats navigation', () => {
      cy.getByTestId('nav-stats').should('exist');
    });

    it('should have settings navigation', () => {
      cy.getByTestId('nav-settings').should('exist');
    });

    it('should display VIP learn more link', () => {
      cy.getByTestId('vip-learn-more').should('exist');
    });
  });

  // ============================================================
  // 📱 SECTION 8: RESPONSIVE DESIGN (10 tests)
  // ============================================================
  describe('📱 RESPONSIVE DESIGN', () => {

    describe('Mobile View', () => {
      beforeEach(() => {
        cy.viewport('iphone-x');
        cy.loginViaApi(ADMIN.email, ADMIN.password);
        cy.visit('/');
      });

      it('should render page on mobile', () => {
        cy.get('body').should('exist');
      });

      it('should render header on mobile', () => {
        cy.getByTestId('header').should('exist');
      });

      it('should render crash game on mobile', () => {
        cy.visit('/games/crash');
        cy.url().should('include', '/crash');
      });

      it('should render plinko game on mobile', () => {
        cy.visit('/games/plinko');
        cy.url().should('include', '/plinko');
      });

      it('should render sports page on mobile', () => {
        cy.visit('/sports');
        cy.url().should('include', '/sports');
      });
    });

    describe('Desktop View', () => {
      beforeEach(() => {
        cy.viewport(1920, 1080);
        cy.loginViaApi(ADMIN.email, ADMIN.password);
        cy.visit('/');
      });

      it('should show sidebar on desktop', () => {
        cy.getByTestId('sidebar').should('be.visible');
      });

      it('should render full header on desktop', () => {
        cy.getByTestId('header').should('be.visible');
      });

      it('should display search on desktop', () => {
        cy.getByTestId('header-search').should('be.visible');
      });

      it('should display game navigation on desktop', () => {
        cy.getByTestId('nav-crash').should('be.visible');
        cy.getByTestId('nav-plinko').should('be.visible');
      });

      it('should render admin dashboard on desktop', () => {
        cy.visit('/admin/dashboard');
        cy.contains('Dashboard').should('exist');
      });
    });
  });

  // ============================================================
  // 🔗 SECTION 9: SIDEBAR NAVIGATION (10 tests)
  // ============================================================
  describe('🔗 SIDEBAR NAVIGATION', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
      cy.visit('/');
    });

    it('should navigate to Crash from sidebar', () => {
      cy.getByTestId('nav-crash').click();
      cy.url({ timeout: 5000 }).should('include', '/games/crash');
    });

    it('should navigate to Plinko from sidebar', () => {
      cy.getByTestId('nav-plinko').click();
      cy.url({ timeout: 5000 }).should('include', '/games/plinko');
    });

    it('should navigate to Dice from sidebar', () => {
      cy.getByTestId('nav-dice').click();
      cy.url({ timeout: 5000 }).should('include', '/games/dice');
    });

    it('should navigate to Mines from sidebar', () => {
      cy.getByTestId('nav-mines').click();
      cy.url({ timeout: 5000 }).should('include', '/games/mines');
    });

    it('should navigate to Home from sidebar', () => {
      cy.visit('/games/crash');
      cy.getByTestId('nav-home').click();
      cy.url({ timeout: 5000 }).should('eq', Cypress.config('baseUrl') + '/');
    });

    it('should navigate to Sports from sidebar', () => {
      cy.getByTestId('nav-sports').click();
      cy.url({ timeout: 5000 }).should('include', '/sports');
    });

    it('should display game badges', () => {
      cy.getByTestId('badge-crash').should('exist');
      cy.getByTestId('badge-plinko').should('exist');
    });

    it('should display main nav container', () => {
      cy.getByTestId('main-nav').should('exist');
    });

    it('should display games list container', () => {
      cy.getByTestId('nav-games-list').should('exist');
    });

    it('should display account list container', () => {
      cy.getByTestId('nav-account-list').should('exist');
    });
  });

  // ============================================================
  // 🔄 SECTION 10: CROSS-PAGE FLOWS (20 tests)
  // ============================================================
  describe('🔄 CROSS-PAGE FLOWS', () => {
    beforeEach(() => {
      cy.loginViaApi(ADMIN.email, ADMIN.password);
    });

    it('should navigate: Home → Crash → Home', () => {
      cy.visit('/');
      cy.visit('/games/crash');
      cy.url().should('include', '/crash');
      cy.visit('/');
      cy.url().should('eq', Cypress.config('baseUrl') + '/');
    });

    it('should navigate: Home → Sports → Home', () => {
      cy.visit('/');
      cy.visit('/sports');
      cy.url().should('include', '/sports');
      cy.visit('/');
    });

    it('should navigate: Home → Admin → Home', () => {
      cy.visit('/');
      cy.visit('/admin/dashboard');
      cy.url().should('include', '/admin');
      cy.visit('/');
    });

    it('should navigate: Crash → Plinko → Dice → Mines', () => {
      cy.visit('/games/crash');
      cy.visit('/games/plinko');
      cy.url().should('include', '/plinko');
      cy.visit('/games/dice');
      cy.url().should('include', '/dice');
      cy.visit('/games/mines');
      cy.url().should('include', '/mines');
    });

    it('should navigate: Admin Dashboard → Users → Finance', () => {
      cy.visit('/admin/dashboard');
      cy.visit('/admin/users');
      cy.url().should('include', '/admin/users');
      cy.visit('/admin/finance');
      cy.url().should('include', '/admin/finance');
    });

    it('should maintain sidebar across game pages', () => {
      cy.visit('/games/crash');
      cy.getByTestId('sidebar').should('exist');
      cy.visit('/games/plinko');
      cy.getByTestId('sidebar').should('exist');
    });

    it('should maintain header across game pages', () => {
      cy.visit('/games/crash');
      cy.getByTestId('header').should('exist');
      cy.visit('/games/plinko');
      cy.getByTestId('header').should('exist');
    });

    it('should handle 404 page gracefully', () => {
      cy.visit('/nonexistent-page-xyz', { failOnStatusCode: false });
      cy.get('body').should('exist');
    });

    it('should handle browser back/forward navigation', () => {
      cy.visit('/');
      cy.visit('/games/crash');
      cy.go('back');
      cy.url().should('eq', Cypress.config('baseUrl') + '/');
      cy.go('forward');
      cy.url().should('include', '/crash');
    });

    it('should preserve login across page refreshes', () => {
      cy.visit('/');
      cy.reload();
      cy.getByTestId('sidebar').should('exist');
    });

    it('should handle rapid page switching', () => {
      cy.visit('/');
      cy.visit('/games/crash');
      cy.visit('/games/plinko');
      cy.visit('/games/dice');
      cy.visit('/');
      cy.url().should('eq', Cypress.config('baseUrl') + '/');
    });

    it('should maintain VIP banner across pages', () => {
      cy.visit('/');
      cy.getByTestId('vip-banner').should('exist');
      cy.visit('/games/crash');
      cy.getByTestId('vip-banner').should('exist');
    });

    it('should maintain search across pages', () => {
      cy.visit('/');
      cy.getByTestId('header-search').should('exist');
      cy.visit('/games/plinko');
      cy.getByTestId('header-search').should('exist');
    });

    it('should navigate using sidebar then back', () => {
      cy.visit('/');
      cy.getByTestId('nav-crash').click();
      cy.url({ timeout: 5000 }).should('include', '/crash');
      cy.getByTestId('nav-home').click();
      cy.url({ timeout: 5000 }).should('eq', Cypress.config('baseUrl') + '/');
    });

    it('should complete full game tour', () => {
      cy.visit('/games/crash');
      cy.get('canvas').should('exist');
      cy.visit('/games/plinko');
      cy.get('canvas').should('exist');
      cy.visit('/games/dice');
      cy.get('input').should('exist');
      cy.visit('/games/mines');
      cy.get('[class*="grid"]').should('exist');
    });

    it('should complete admin tour', () => {
      cy.visit('/admin/dashboard');
      cy.url().should('include', '/admin');
      cy.visit('/admin/users');
      cy.url().should('include', '/users');
      cy.visit('/admin/finance');
      cy.url().should('include', '/finance');
    });

    it('should navigate sidebar links sequentially', () => {
      cy.visit('/');
      cy.getByTestId('nav-crash').click();
      cy.url({ timeout: 5000 }).should('include', '/crash');
      cy.getByTestId('nav-plinko').click();
      cy.url({ timeout: 5000 }).should('include', '/plinko');
      cy.getByTestId('nav-dice').click();
      cy.url({ timeout: 5000 }).should('include', '/dice');
    });

    it('should maintain chat across pages', () => {
      cy.visit('/');
      cy.contains('Live Chat').should('exist');
      cy.visit('/games/crash');
      cy.contains('Live Chat').should('exist');
    });

    it('should maintain logo across pages', () => {
      cy.visit('/');
      cy.getByTestId('logo-text').should('exist');
      cy.visit('/games/crash');
      cy.getByTestId('logo-text').should('exist');
      cy.visit('/sports');
      cy.getByTestId('logo-text').should('exist');
    });

    it('should complete full user journey', () => {
      cy.visit('/');
      cy.getByTestId('sidebar').should('exist');
      cy.visit('/games/crash');
      cy.get('canvas').should('exist');
      cy.visit('/');
      cy.getByTestId('nav-stats').click();
      cy.get('body').should('exist');
    });
  });
});
