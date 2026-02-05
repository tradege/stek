/// <reference types="cypress" />

/**
 * 🧭 NAVIGATION E2E TESTS
 * Phase 36: Operation "Pixel Perfect"
 * 
 * Tests all navigation and UI interactions:
 * - Sidebar navigation
 * - Game lobby cards
 * - Wallet modal
 * - User menu
 * - Footer links
 */

describe('🧭 Navigation - Full UI Coverage Tests', () => {

  beforeEach(() => {
    cy.visit('/');
  });

  // ==========================================
  // 📱 SIDEBAR NAVIGATION TESTS
  // ==========================================
  describe('📱 Sidebar Navigation', () => {
    
    it('Should display sidebar on desktop', () => {
      cy.viewport(1280, 720);
      cy.get('[data-testid="sidebar"]').should('be.visible');
    });

    it('Should have Casino section', () => {
      cy.get('[data-testid="sidebar-casino"]').should('be.visible');
    });

    it('Should have Sports section', () => {
      cy.get('[data-testid="sidebar-sports"]').should('be.visible');
    });

    it('Should navigate to Casino when clicked', () => {
      cy.get('[data-testid="sidebar-casino"]').click();
      cy.url().should('include', '/casino');
    });

    it('Should navigate to Sports when clicked', () => {
      cy.get('[data-testid="sidebar-sports"]').click();
      cy.url().should('include', '/sports');
    });

    it('Should highlight active section', () => {
      cy.get('[data-testid="sidebar-casino"]').click();
      cy.get('[data-testid="sidebar-casino"]').should('have.class', 'active');
    });

    it('Should display game categories', () => {
      cy.get('[data-testid="category-originals"]').should('be.visible');
      cy.get('[data-testid="category-slots"]').should('be.visible');
      cy.get('[data-testid="category-live"]').should('be.visible');
    });

    it('Should expand/collapse categories', () => {
      cy.get('[data-testid="category-originals"]').click();
      cy.get('[data-testid="category-originals-games"]').should('be.visible');
      
      cy.get('[data-testid="category-originals"]').click();
      cy.get('[data-testid="category-originals-games"]').should('not.be.visible');
    });

    it('Should show game count in categories', () => {
      cy.get('[data-testid="category-originals-count"]')
        .invoke('text')
        .then((text) => {
          expect(parseInt(text)).to.be.at.least(1);
        });
    });
  });

  // ==========================================
  // 🎮 GAME LOBBY TESTS
  // ==========================================
  describe('🎮 Game Lobby', () => {
    
    beforeEach(() => {
      cy.visit('/casino');
    });

    it('Should display game cards', () => {
      cy.get('[data-testid="game-card"]').should('have.length.at.least', 1);
    });

    it('Should show Crash game card', () => {
      cy.get('[data-testid="game-card-crash"]').should('be.visible');
    });

    it('Should show Plinko game card', () => {
      cy.get('[data-testid="game-card-plinko"]').should('be.visible');
    });

    it('Should navigate to Crash when card clicked', () => {
      cy.get('[data-testid="game-card-crash"]').click();
      cy.url().should('include', '/games/crash');
    });

    it('Should navigate to Plinko when card clicked', () => {
      cy.get('[data-testid="game-card-plinko"]').click();
      cy.url().should('include', '/games/plinko');
    });

    it('Should show hover effect on game cards', () => {
      cy.get('[data-testid="game-card-crash"]').trigger('mouseover');
      cy.get('[data-testid="game-card-crash"]')
        .should('have.css', 'transform')
        .and('not.eq', 'none');
    });

    it('Should show "Coming Soon" badge for unreleased games', () => {
      cy.get('[data-testid="game-card-coming-soon"]').should('exist');
      cy.get('[data-testid="coming-soon-badge"]').should('be.visible');
    });

    it('Should not navigate when clicking Coming Soon card', () => {
      cy.get('[data-testid="game-card-coming-soon"]').first().click();
      cy.url().should('include', '/casino');
    });

    it('Should show Play button on hover', () => {
      cy.get('[data-testid="game-card-crash"]').trigger('mouseover');
      cy.get('[data-testid="game-card-crash"] [data-testid="play-button"]')
        .should('be.visible');
    });

    it('Should filter games by category', () => {
      cy.get('[data-testid="filter-originals"]').click();
      cy.get('[data-testid="game-card"]').each(($card) => {
        cy.wrap($card).should('have.attr', 'data-category', 'originals');
      });
    });

    it('Should search games by name', () => {
      cy.get('[data-testid="game-search"]').type('crash');
      cy.get('[data-testid="game-card"]').should('have.length', 1);
      cy.get('[data-testid="game-card-crash"]').should('be.visible');
    });
  });

  // ==========================================
  // 💰 WALLET MODAL TESTS
  // ==========================================
  describe('💰 Wallet Modal', () => {
    
    it('Should open wallet modal when button clicked', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="wallet-modal"]').should('be.visible');
    });

    it('Should display Deposit tab', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="deposit-tab"]').should('be.visible');
    });

    it('Should display Withdraw tab', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="withdraw-tab"]').should('be.visible');
    });

    it('Should switch between tabs', () => {
      cy.get('[data-testid="wallet-button"]').click();
      
      cy.get('[data-testid="deposit-tab"]').click();
      cy.get('[data-testid="deposit-content"]').should('be.visible');
      
      cy.get('[data-testid="withdraw-tab"]').click();
      cy.get('[data-testid="withdraw-content"]').should('be.visible');
    });

    it('Should display currency options', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="currency-BTC"]').should('be.visible');
      cy.get('[data-testid="currency-ETH"]').should('be.visible');
      cy.get('[data-testid="currency-USDT"]').should('be.visible');
    });

    it('Should show deposit address when currency selected', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="currency-BTC"]').click();
      cy.get('[data-testid="deposit-address"]').should('be.visible');
    });

    it('Should copy address to clipboard', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="currency-BTC"]').click();
      cy.get('[data-testid="copy-address-button"]').click();
      cy.get('[data-testid="toast"]').should('contain', 'Copied');
    });

    it('Should show QR code for deposit', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="currency-BTC"]').click();
      cy.get('[data-testid="qr-code"]').should('be.visible');
    });

    it('Should close modal when X clicked', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="modal-close"]').click();
      cy.get('[data-testid="wallet-modal"]').should('not.exist');
    });

    it('Should close modal when clicking outside', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="modal-overlay"]').click({ force: true });
      cy.get('[data-testid="wallet-modal"]').should('not.exist');
    });

    it('Should validate withdraw amount', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="withdraw-tab"]').click();
      cy.get('[data-testid="withdraw-amount"]').type('999999');
      cy.get('[data-testid="withdraw-submit"]').click();
      cy.get('[data-testid="error-message"]').should('contain', 'Insufficient');
    });

    it('Should validate withdraw address', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="withdraw-tab"]').click();
      cy.get('[data-testid="withdraw-amount"]').type('10');
      cy.get('[data-testid="withdraw-address"]').type('invalid');
      cy.get('[data-testid="withdraw-submit"]').click();
      cy.get('[data-testid="error-message"]').should('contain', 'Invalid address');
    });
  });

  // ==========================================
  // 👤 USER MENU TESTS
  // ==========================================
  describe('👤 User Menu', () => {
    
    it('Should show login button when not logged in', () => {
      cy.clearCookies();
      cy.visit('/');
      cy.get('[data-testid="login-button"]').should('be.visible');
    });

    it('Should show user menu when logged in', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').should('be.visible');
    });

    it('Should open user dropdown on click', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="user-dropdown"]').should('be.visible');
    });

    it('Should show Profile option', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="menu-profile"]').should('be.visible');
    });

    it('Should show Settings option', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="menu-settings"]').should('be.visible');
    });

    it('Should show Logout option', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="menu-logout"]').should('be.visible');
    });

    it('Should navigate to Profile page', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="menu-profile"]').click();
      cy.url().should('include', '/profile');
    });

    it('Should logout when Logout clicked', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="menu-logout"]').click();
      cy.get('[data-testid="login-button"]').should('be.visible');
    });

    it('Should display user balance', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-balance"]').should('be.visible');
    });

    it('Should display username', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="user-menu"]').click();
      cy.get('[data-testid="user-username"]').should('be.visible');
    });
  });

  // ==========================================
  // 🔗 HEADER NAVIGATION TESTS
  // ==========================================
  describe('🔗 Header Navigation', () => {
    
    it('Should display logo', () => {
      cy.get('[data-testid="logo"]').should('be.visible');
    });

    it('Should navigate to home when logo clicked', () => {
      cy.visit('/casino');
      cy.get('[data-testid="logo"]').click();
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });

    it('Should display main navigation links', () => {
      cy.get('[data-testid="nav-casino"]').should('be.visible');
      cy.get('[data-testid="nav-sports"]').should('be.visible');
    });

    it('Should display search button', () => {
      cy.get('[data-testid="search-button"]').should('be.visible');
    });

    it('Should open search modal when clicked', () => {
      cy.get('[data-testid="search-button"]').click();
      cy.get('[data-testid="search-modal"]').should('be.visible');
    });

    it('Should search games in search modal', () => {
      cy.get('[data-testid="search-button"]').click();
      cy.get('[data-testid="search-input"]').type('crash');
      cy.get('[data-testid="search-results"]').should('contain', 'Crash');
    });
  });

  // ==========================================
  // 📜 FOOTER TESTS
  // ==========================================
  describe('📜 Footer', () => {
    
    it('Should display footer', () => {
      cy.get('[data-testid="footer"]').should('be.visible');
    });

    it('Should display Terms of Service link', () => {
      cy.get('[data-testid="footer-terms"]').should('be.visible');
    });

    it('Should display Privacy Policy link', () => {
      cy.get('[data-testid="footer-privacy"]').should('be.visible');
    });

    it('Should display social media links', () => {
      cy.get('[data-testid="social-twitter"]').should('be.visible');
      cy.get('[data-testid="social-discord"]').should('be.visible');
      cy.get('[data-testid="social-telegram"]').should('be.visible');
    });

    it('Should navigate to Terms page', () => {
      cy.get('[data-testid="footer-terms"]').click();
      cy.url().should('include', '/terms');
    });

    it('Should navigate to Privacy page', () => {
      cy.get('[data-testid="footer-privacy"]').click();
      cy.url().should('include', '/privacy');
    });

    it('Should display copyright', () => {
      cy.get('[data-testid="footer-copyright"]').should('contain', '2024');
    });
  });

  // ==========================================
  // 🔔 NOTIFICATIONS TESTS
  // ==========================================
  describe('🔔 Notifications', () => {
    
    it('Should display notification bell', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="notification-bell"]').should('be.visible');
    });

    it('Should show notification count badge', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="notification-count"]').should('be.visible');
    });

    it('Should open notification dropdown', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="notification-bell"]').click();
      cy.get('[data-testid="notification-dropdown"]').should('be.visible');
    });

    it('Should mark notifications as read', () => {
      cy.login('test@test.com', 'password123');
      cy.visit('/');
      cy.get('[data-testid="notification-bell"]').click();
      cy.get('[data-testid="mark-all-read"]').click();
      cy.get('[data-testid="notification-count"]').should('not.exist');
    });
  });

  // ==========================================
  // 🌐 LANGUAGE SWITCHER TESTS
  // ==========================================
  describe('🌐 Language Switcher', () => {
    
    it('Should display language switcher', () => {
      cy.get('[data-testid="language-switcher"]').should('be.visible');
    });

    it('Should show available languages', () => {
      cy.get('[data-testid="language-switcher"]').click();
      cy.get('[data-testid="language-en"]').should('be.visible');
    });

    it('Should switch language', () => {
      cy.get('[data-testid="language-switcher"]').click();
      cy.get('[data-testid="language-en"]').click();
      cy.get('html').should('have.attr', 'lang', 'en');
    });
  });

  // ==========================================
  // ⌨️ KEYBOARD NAVIGATION TESTS
  // ==========================================
  describe('⌨️ Keyboard Navigation', () => {
    
    it('Should navigate with Tab key', () => {
      cy.get('body').tab();
      cy.focused().should('exist');
    });

    it('Should have visible focus indicators', () => {
      cy.get('[data-testid="nav-casino"]').focus();
      cy.get('[data-testid="nav-casino"]')
        .should('have.css', 'outline')
        .and('not.eq', 'none');
    });

    it('Should close modals with Escape key', () => {
      cy.get('[data-testid="wallet-button"]').click();
      cy.get('[data-testid="wallet-modal"]').should('be.visible');
      cy.get('body').type('{esc}');
      cy.get('[data-testid="wallet-modal"]').should('not.exist');
    });
  });
});
