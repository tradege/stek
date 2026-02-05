/// <reference types="cypress" />

/**
 * 📱 MOBILE RESPONSIVENESS E2E TESTS
 * Phase 36: Operation "Pixel Perfect"
 * 
 * Tests mobile-specific UI behavior:
 * - Hamburger menu
 * - Touch interactions
 * - Responsive layouts
 * - Mobile-specific features
 */

describe('📱 Mobile Responsiveness Tests', () => {

  // ==========================================
  // 📱 iPHONE X VIEWPORT TESTS
  // ==========================================
  describe('📱 iPhone X Viewport (375x812)', () => {
    
    beforeEach(() => {
      cy.viewport('iphone-x');
      cy.visit('/');
    });

    // Sidebar / Hamburger Menu
    describe('🍔 Hamburger Menu', () => {
      
      it('Should hide sidebar on mobile', () => {
        cy.get('[data-testid="sidebar"]').should('not.be.visible');
      });

      it('Should show hamburger menu button', () => {
        cy.get('[data-testid="hamburger-menu"]').should('be.visible');
      });

      it('Should open sidebar when hamburger clicked', () => {
        cy.get('[data-testid="hamburger-menu"]').click();
        cy.get('[data-testid="mobile-sidebar"]').should('be.visible');
      });

      it('Should close sidebar when X clicked', () => {
        cy.get('[data-testid="hamburger-menu"]').click();
        cy.get('[data-testid="mobile-sidebar-close"]').click();
        cy.get('[data-testid="mobile-sidebar"]').should('not.be.visible');
      });

      it('Should close sidebar when overlay clicked', () => {
        cy.get('[data-testid="hamburger-menu"]').click();
        cy.get('[data-testid="sidebar-overlay"]').click({ force: true });
        cy.get('[data-testid="mobile-sidebar"]').should('not.be.visible');
      });

      it('Should navigate and close sidebar', () => {
        cy.get('[data-testid="hamburger-menu"]').click();
        cy.get('[data-testid="mobile-nav-casino"]').click();
        cy.url().should('include', '/casino');
        cy.get('[data-testid="mobile-sidebar"]').should('not.be.visible');
      });
    });

    // Header
    describe('📍 Mobile Header', () => {
      
      it('Should display compact logo', () => {
        cy.get('[data-testid="logo"]').should('be.visible');
        cy.get('[data-testid="logo"]').invoke('width').should('be.lessThan', 150);
      });

      it('Should display wallet button', () => {
        cy.get('[data-testid="wallet-button"]').should('be.visible');
      });

      it('Should display user menu', () => {
        cy.login('test@test.com', 'password123');
        cy.visit('/');
        cy.viewport('iphone-x');
        cy.get('[data-testid="user-menu"]').should('be.visible');
      });

      it('Should hide search in header', () => {
        cy.get('[data-testid="header-search"]').should('not.be.visible');
      });
    });

    // Game Canvas
    describe('🎮 Game Canvas Responsiveness', () => {
      
      it('Should fit Crash game canvas on screen', () => {
        cy.visit('/games/crash');
        cy.viewport('iphone-x');
        cy.get('[data-testid="game-canvas"]').should('be.visible');
        cy.get('[data-testid="game-canvas"]').invoke('width').should('be.lessThan', 376);
      });

      it('Should fit Plinko game canvas on screen', () => {
        cy.visit('/games/plinko');
        cy.viewport('iphone-x');
        cy.get('[data-testid="plinko-canvas"]').should('be.visible');
        cy.get('[data-testid="plinko-canvas"]').invoke('width').should('be.lessThan', 376);
      });

      it('Should stack game controls vertically', () => {
        cy.visit('/games/plinko');
        cy.viewport('iphone-x');
        cy.get('[data-testid="game-controls"]')
          .should('have.css', 'flex-direction', 'column');
      });
    });

    // Wallet Modal
    describe('💰 Mobile Wallet Modal', () => {
      
      it('Should open full-screen wallet modal', () => {
        cy.get('[data-testid="wallet-button"]').click();
        cy.get('[data-testid="wallet-modal"]')
          .should('be.visible')
          .and('have.css', 'width', '375px');
      });

      it('Should have scrollable content', () => {
        cy.get('[data-testid="wallet-button"]').click();
        cy.get('[data-testid="wallet-modal-content"]')
          .should('have.css', 'overflow-y', 'auto');
      });

      it('Should have large touch targets', () => {
        cy.get('[data-testid="wallet-button"]').click();
        cy.get('[data-testid="currency-BTC"]')
          .invoke('height')
          .should('be.at.least', 44); // Apple's minimum touch target
      });
    });

    // Game Lobby
    describe('🎰 Mobile Game Lobby', () => {
      
      beforeEach(() => {
        cy.visit('/casino');
        cy.viewport('iphone-x');
      });

      it('Should display game cards in grid', () => {
        cy.get('[data-testid="game-grid"]').should('be.visible');
      });

      it('Should show 2 cards per row', () => {
        cy.get('[data-testid="game-card"]').first()
          .invoke('width')
          .should('be.lessThan', 188); // Half of 375px
      });

      it('Should have touch-friendly card size', () => {
        cy.get('[data-testid="game-card"]').first()
          .invoke('height')
          .should('be.at.least', 100);
      });
    });

    // Touch Interactions
    describe('👆 Touch Interactions', () => {
      
      it('Should support swipe to close sidebar', () => {
        cy.get('[data-testid="hamburger-menu"]').click();
        cy.get('[data-testid="mobile-sidebar"]')
          .trigger('touchstart', { touches: [{ clientX: 300, clientY: 400 }] })
          .trigger('touchmove', { touches: [{ clientX: 50, clientY: 400 }] })
          .trigger('touchend');
        cy.get('[data-testid="mobile-sidebar"]').should('not.be.visible');
      });

      it('Should have no horizontal scroll', () => {
        cy.get('body').invoke('prop', 'scrollWidth').should('eq', 375);
      });
    });

    // Bottom Navigation
    describe('📍 Bottom Navigation', () => {
      
      it('Should display bottom navigation bar', () => {
        cy.get('[data-testid="bottom-nav"]').should('be.visible');
      });

      it('Should have Home, Casino, Sports, Profile tabs', () => {
        cy.get('[data-testid="bottom-nav-home"]').should('be.visible');
        cy.get('[data-testid="bottom-nav-casino"]').should('be.visible');
        cy.get('[data-testid="bottom-nav-sports"]').should('be.visible');
        cy.get('[data-testid="bottom-nav-profile"]').should('be.visible');
      });

      it('Should navigate when tab clicked', () => {
        cy.get('[data-testid="bottom-nav-casino"]').click();
        cy.url().should('include', '/casino');
      });

      it('Should highlight active tab', () => {
        cy.get('[data-testid="bottom-nav-casino"]').click();
        cy.get('[data-testid="bottom-nav-casino"]').should('have.class', 'active');
      });
    });
  });

  // ==========================================
  // 📱 iPAD VIEWPORT TESTS
  // ==========================================
  describe('📱 iPad Viewport (768x1024)', () => {
    
    beforeEach(() => {
      cy.viewport('ipad-2');
      cy.visit('/');
    });

    it('Should show sidebar on tablet', () => {
      cy.get('[data-testid="sidebar"]').should('be.visible');
    });

    it('Should show collapsed sidebar', () => {
      cy.get('[data-testid="sidebar"]').invoke('width').should('be.lessThan', 100);
    });

    it('Should expand sidebar on hover', () => {
      cy.get('[data-testid="sidebar"]').trigger('mouseover');
      cy.get('[data-testid="sidebar"]').invoke('width').should('be.at.least', 200);
    });

    it('Should fit game canvas on tablet', () => {
      cy.visit('/games/crash');
      cy.viewport('ipad-2');
      cy.get('[data-testid="game-canvas"]').invoke('width').should('be.lessThan', 769);
    });

    it('Should show 3 game cards per row', () => {
      cy.visit('/casino');
      cy.viewport('ipad-2');
      cy.get('[data-testid="game-card"]').first()
        .invoke('width')
        .should('be.lessThan', 260); // ~1/3 of 768px
    });
  });

  // ==========================================
  // 📱 SAMSUNG GALAXY VIEWPORT TESTS
  // ==========================================
  describe('📱 Samsung Galaxy S21 (360x800)', () => {
    
    beforeEach(() => {
      cy.viewport(360, 800);
      cy.visit('/');
    });

    it('Should display correctly on narrow screen', () => {
      cy.get('[data-testid="hamburger-menu"]').should('be.visible');
      cy.get('[data-testid="sidebar"]').should('not.be.visible');
    });

    it('Should fit all content without horizontal scroll', () => {
      cy.get('body').invoke('prop', 'scrollWidth').should('eq', 360);
    });

    it('Should have readable text size', () => {
      cy.get('body').should('have.css', 'font-size').and('not.eq', '0px');
    });
  });

  // ==========================================
  // 🔄 ORIENTATION CHANGE TESTS
  // ==========================================
  describe('🔄 Orientation Changes', () => {
    
    it('Should handle portrait to landscape change', () => {
      cy.viewport('iphone-x');
      cy.visit('/games/crash');
      cy.get('[data-testid="game-canvas"]').should('be.visible');
      
      // Change to landscape
      cy.viewport(812, 375);
      cy.get('[data-testid="game-canvas"]').should('be.visible');
    });

    it('Should resize game canvas on orientation change', () => {
      cy.viewport('iphone-x');
      cy.visit('/games/plinko');
      cy.get('[data-testid="plinko-canvas"]').invoke('width').as('portraitWidth');
      
      cy.viewport(812, 375);
      cy.get('[data-testid="plinko-canvas"]').invoke('width').then((landscapeWidth) => {
        cy.get('@portraitWidth').should('not.eq', landscapeWidth);
      });
    });
  });

  // ==========================================
  // 🎯 TOUCH TARGET SIZE TESTS
  // ==========================================
  describe('🎯 Touch Target Sizes', () => {
    
    beforeEach(() => {
      cy.viewport('iphone-x');
      cy.visit('/');
    });

    it('All buttons should have minimum 44px touch target', () => {
      cy.get('button:visible').each(($btn) => {
        cy.wrap($btn).invoke('outerHeight').should('be.at.least', 44);
      });
    });

    it('All links should have minimum 44px touch target', () => {
      cy.get('a:visible').each(($link) => {
        cy.wrap($link).invoke('outerHeight').should('be.at.least', 44);
      });
    });

    it('Input fields should have adequate height', () => {
      cy.visit('/games/plinko');
      cy.viewport('iphone-x');
      cy.get('[data-testid="bet-amount-input"]')
        .invoke('outerHeight')
        .should('be.at.least', 44);
    });
  });

  // ==========================================
  // 🔤 MOBILE TYPOGRAPHY TESTS
  // ==========================================
  describe('🔤 Mobile Typography', () => {
    
    beforeEach(() => {
      cy.viewport('iphone-x');
      cy.visit('/');
    });

    it('Should have readable base font size', () => {
      cy.get('body').should('have.css', 'font-size').and((fontSize) => {
        expect(parseInt(fontSize as unknown as string)).to.be.at.least(14);
      });
    });

    it('Should not have text overflow', () => {
      cy.get('p, span, h1, h2, h3').each(($el) => {
        cy.wrap($el).invoke('prop', 'scrollWidth').then((scrollWidth) => {
          cy.wrap($el).invoke('prop', 'clientWidth').should('be.at.least', scrollWidth);
        });
      });
    });
  });

  // ==========================================
  // ⚡ MOBILE PERFORMANCE TESTS
  // ==========================================
  describe('⚡ Mobile Performance', () => {
    
    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('Should load homepage within 3 seconds', () => {
      cy.visit('/', { timeout: 3000 });
      cy.get('[data-testid="logo"]').should('be.visible');
    });

    it('Should load game page within 3 seconds', () => {
      cy.visit('/games/crash', { timeout: 3000 });
      cy.get('[data-testid="game-canvas"]').should('be.visible');
    });

    it('Should not have layout shifts', () => {
      cy.visit('/');
      cy.get('[data-testid="logo"]').invoke('offset').as('initialOffset');
      cy.wait(1000);
      cy.get('[data-testid="logo"]').invoke('offset').then((newOffset) => {
        cy.get('@initialOffset').should('deep.eq', newOffset);
      });
    });
  });

  // ==========================================
  // 🔒 MOBILE SECURITY TESTS
  // ==========================================
  describe('🔒 Mobile Security', () => {
    
    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('Should use secure input for password', () => {
      cy.visit('/auth/login');
      cy.get('[data-testid="password-input"]')
        .should('have.attr', 'type', 'password');
    });

    it('Should not autocomplete sensitive fields', () => {
      cy.visit('/auth/login');
      cy.get('[data-testid="password-input"]')
        .should('have.attr', 'autocomplete', 'new-password');
    });
  });
});
