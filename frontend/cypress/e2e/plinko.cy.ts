/// <reference types="cypress" />

/**
 * 🎮 PLINKO GAME E2E TESTS
 * Phase 36: Operation "Pixel Perfect"
 * 
 * Tests all user interactions with the Plinko game:
 * - Risk level switching
 * - Rows slider
 * - Bet input validation
 * - Game flow (bet -> animation -> result)
 * - Keyboard shortcuts
 */

describe('🎮 Plinko Game - Full Interaction Tests', () => {
  
  beforeEach(() => {
    // Visit Plinko game page
    cy.visit('/games/plinko');
    
    // Wait for page to load
    cy.get('[data-testid="plinko-game"]', { timeout: 10000 }).should('be.visible');
  });

  // ==========================================
  // 🎚️ RISK LEVEL SWITCHING TESTS
  // ==========================================
  describe('🎚️ Risk Level Controls', () => {
    
    it('Should display all three risk levels (Low, Medium, High)', () => {
      cy.get('[data-testid="risk-low"]').should('be.visible');
      cy.get('[data-testid="risk-medium"]').should('be.visible');
      cy.get('[data-testid="risk-high"]').should('be.visible');
    });

    it('Should switch to LOW risk when clicked', () => {
      cy.get('[data-testid="risk-low"]').click();
      cy.get('[data-testid="risk-low"]')
        .should('have.class', 'active')
        .or('have.attr', 'data-active', 'true');
      cy.get('[data-testid="current-risk"]').should('contain', 'Low');
    });

    it('Should switch to MEDIUM risk when clicked', () => {
      cy.get('[data-testid="risk-medium"]').click();
      cy.get('[data-testid="risk-medium"]')
        .should('have.class', 'active')
        .or('have.attr', 'data-active', 'true');
      cy.get('[data-testid="current-risk"]').should('contain', 'Medium');
    });

    it('Should switch to HIGH risk when clicked', () => {
      cy.get('[data-testid="risk-high"]').click();
      cy.get('[data-testid="risk-high"]')
        .should('have.class', 'active')
        .or('have.attr', 'data-active', 'true');
      cy.get('[data-testid="current-risk"]').should('contain', 'High');
    });

    it('Should update multiplier display when risk changes', () => {
      // Get initial multipliers
      cy.get('[data-testid="multiplier-display"]').invoke('text').as('initialMultipliers');
      
      // Change risk
      cy.get('[data-testid="risk-high"]').click();
      
      // Verify multipliers changed
      cy.get('[data-testid="multiplier-display"]').invoke('text').then((newMultipliers) => {
        cy.get('@initialMultipliers').should('not.eq', newMultipliers);
      });
    });

    it('Should change button color based on risk level', () => {
      // Low = Green
      cy.get('[data-testid="risk-low"]').click();
      cy.get('[data-testid="risk-indicator"]').should('have.class', 'bg-green');
      
      // Medium = Yellow/Orange
      cy.get('[data-testid="risk-medium"]').click();
      cy.get('[data-testid="risk-indicator"]').should('have.class', 'bg-yellow');
      
      // High = Red
      cy.get('[data-testid="risk-high"]').click();
      cy.get('[data-testid="risk-indicator"]').should('have.class', 'bg-red');
    });
  });

  // ==========================================
  // 📏 ROWS SLIDER TESTS
  // ==========================================
  describe('📏 Rows Slider Controls', () => {
    
    it('Should display rows slider with min 8 and max 16', () => {
      cy.get('[data-testid="rows-slider"]')
        .should('be.visible')
        .and('have.attr', 'min', '8')
        .and('have.attr', 'max', '16');
    });

    it('Should update rows display when slider moves', () => {
      cy.get('[data-testid="rows-slider"]').invoke('val', 12).trigger('input');
      cy.get('[data-testid="rows-display"]').should('contain', '12');
    });

    it('Should redraw canvas pins when rows change', () => {
      // Get initial canvas state
      cy.get('[data-testid="plinko-canvas"]').then(($canvas) => {
        const initialState = $canvas[0].toDataURL();
        
        // Change rows
        cy.get('[data-testid="rows-slider"]').invoke('val', 14).trigger('input');
        
        // Wait for redraw
        cy.wait(500);
        
        // Verify canvas changed
        cy.get('[data-testid="plinko-canvas"]').then(($newCanvas) => {
          expect($newCanvas[0].toDataURL()).to.not.equal(initialState);
        });
      });
    });

    it('Should show correct number of buckets for each row count', () => {
      // 8 rows = 9 buckets
      cy.get('[data-testid="rows-slider"]').invoke('val', 8).trigger('input');
      cy.get('[data-testid="bucket"]').should('have.length', 9);
      
      // 12 rows = 13 buckets
      cy.get('[data-testid="rows-slider"]').invoke('val', 12).trigger('input');
      cy.get('[data-testid="bucket"]').should('have.length', 13);
      
      // 16 rows = 17 buckets
      cy.get('[data-testid="rows-slider"]').invoke('val', 16).trigger('input');
      cy.get('[data-testid="bucket"]').should('have.length', 17);
    });

    it('Should not allow rows below 8', () => {
      cy.get('[data-testid="rows-slider"]').invoke('val', 5).trigger('input');
      cy.get('[data-testid="rows-display"]').should('contain', '8');
    });

    it('Should not allow rows above 16', () => {
      cy.get('[data-testid="rows-slider"]').invoke('val', 20).trigger('input');
      cy.get('[data-testid="rows-display"]').should('contain', '16');
    });
  });

  // ==========================================
  // 💰 BET INPUT VALIDATION TESTS
  // ==========================================
  describe('💰 Bet Input Validation', () => {
    
    it('Should accept valid positive numbers', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('100');
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '100');
    });

    it('Should block negative numbers', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('-5');
      cy.get('[data-testid="bet-amount-input"]').should('not.have.value', '-5');
    });

    it('Should block non-numeric input', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('abc');
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '');
    });

    it('Should accept decimal numbers', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10.50');
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '10.50');
    });

    it('Should have minimum bet validation', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('0.001');
      cy.get('[data-testid="bet-button"]').click();
      cy.get('[data-testid="error-message"]').should('contain', 'Minimum bet');
    });

    it('Should have maximum bet validation', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('1000000');
      cy.get('[data-testid="bet-button"]').click();
      cy.get('[data-testid="error-message"]').should('contain', 'Maximum bet');
    });

    it('Should update bet with quick bet buttons', () => {
      cy.get('[data-testid="quick-bet-10"]').click();
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '10');
      
      cy.get('[data-testid="quick-bet-50"]').click();
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '50');
      
      cy.get('[data-testid="quick-bet-100"]').click();
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '100');
    });

    it('Should double bet with 2x button', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('25');
      cy.get('[data-testid="bet-2x"]').click();
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '50');
    });

    it('Should halve bet with 1/2 button', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('100');
      cy.get('[data-testid="bet-half"]').click();
      cy.get('[data-testid="bet-amount-input"]').should('have.value', '50');
    });

    it('Should set max bet with MAX button', () => {
      cy.get('[data-testid="bet-max"]').click();
      cy.get('[data-testid="bet-amount-input"]').invoke('val').then((val) => {
        expect(parseFloat(val as string)).to.be.greaterThan(0);
      });
    });
  });

  // ==========================================
  // 🎲 GAME FLOW TESTS
  // ==========================================
  describe('🎲 Game Flow', () => {
    
    it('Should start game when bet button clicked', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      // Verify game started
      cy.get('[data-testid="game-status"]').should('contain', 'Playing');
    });

    it('Should show ball animation after bet', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      // Verify ball is visible
      cy.get('[data-testid="plinko-ball"]', { timeout: 5000 }).should('be.visible');
    });

    it('Should show result after animation completes', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      // Wait for animation to complete (max 5 seconds)
      cy.get('[data-testid="game-result"]', { timeout: 10000 }).should('be.visible');
    });

    it('Should display correct multiplier in result', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      cy.get('[data-testid="result-multiplier"]', { timeout: 10000 })
        .invoke('text')
        .then((text) => {
          const multiplier = parseFloat(text.replace('x', ''));
          expect(multiplier).to.be.at.least(0);
        });
    });

    it('Should update balance after game', () => {
      // Get initial balance
      cy.get('[data-testid="user-balance"]').invoke('text').as('initialBalance');
      
      // Place bet
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      // Wait for result
      cy.get('[data-testid="game-result"]', { timeout: 10000 }).should('be.visible');
      
      // Verify balance changed
      cy.get('[data-testid="user-balance"]').invoke('text').then((newBalance) => {
        cy.get('@initialBalance').should('not.eq', newBalance);
      });
    });

    it('Should disable bet button during animation', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      // Button should be disabled during animation
      cy.get('[data-testid="bet-button"]').should('be.disabled');
    });

    it('Should re-enable bet button after animation', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      // Wait for animation to complete
      cy.get('[data-testid="game-result"]', { timeout: 10000 }).should('be.visible');
      
      // Button should be enabled again
      cy.get('[data-testid="bet-button"]').should('not.be.disabled');
    });
  });

  // ==========================================
  // ⌨️ KEYBOARD SHORTCUTS TESTS
  // ==========================================
  describe('⌨️ Keyboard Shortcuts', () => {
    
    it('Should place bet with Spacebar', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('body').type(' '); // Spacebar
      
      cy.get('[data-testid="game-status"]').should('contain', 'Playing');
    });

    it('Should focus bet input with Tab', () => {
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'bet-amount-input');
    });

    it('Should not trigger bet when input is focused and Space pressed', () => {
      cy.get('[data-testid="bet-amount-input"]').focus().type(' ');
      cy.get('[data-testid="game-status"]').should('not.contain', 'Playing');
    });
  });

  // ==========================================
  // 🎨 VISUAL ELEMENTS TESTS
  // ==========================================
  describe('🎨 Visual Elements', () => {
    
    it('Should display game canvas', () => {
      cy.get('[data-testid="plinko-canvas"]').should('be.visible');
    });

    it('Should display multiplier buckets', () => {
      cy.get('[data-testid="bucket"]').should('have.length.at.least', 9);
    });

    it('Should display colored buckets based on multiplier', () => {
      // High multiplier buckets should be red/orange
      cy.get('[data-testid="bucket-high"]').should('have.class', 'bg-red');
      
      // Low multiplier buckets should be blue/green
      cy.get('[data-testid="bucket-low"]').should('have.class', 'bg-blue');
    });

    it('Should display bet history', () => {
      cy.get('[data-testid="bet-history"]').should('be.visible');
    });

    it('Should display game statistics', () => {
      cy.get('[data-testid="game-stats"]').should('be.visible');
    });
  });

  // ==========================================
  // 🔊 SOUND CONTROLS TESTS
  // ==========================================
  describe('🔊 Sound Controls', () => {
    
    it('Should have sound toggle button', () => {
      cy.get('[data-testid="sound-toggle"]').should('be.visible');
    });

    it('Should toggle sound on/off', () => {
      cy.get('[data-testid="sound-toggle"]').click();
      cy.get('[data-testid="sound-toggle"]').should('have.attr', 'data-muted', 'true');
      
      cy.get('[data-testid="sound-toggle"]').click();
      cy.get('[data-testid="sound-toggle"]').should('have.attr', 'data-muted', 'false');
    });
  });

  // ==========================================
  // 📱 RESPONSIVE TESTS
  // ==========================================
  describe('📱 Responsive Design', () => {
    
    it('Should display correctly on tablet', () => {
      cy.viewport('ipad-2');
      cy.get('[data-testid="plinko-game"]').should('be.visible');
      cy.get('[data-testid="plinko-canvas"]').should('be.visible');
    });

    it('Should display correctly on mobile', () => {
      cy.viewport('iphone-x');
      cy.get('[data-testid="plinko-game"]').should('be.visible');
      cy.get('[data-testid="plinko-canvas"]').should('be.visible');
    });

    it('Should stack controls on mobile', () => {
      cy.viewport('iphone-x');
      cy.get('[data-testid="game-controls"]').should('have.css', 'flex-direction', 'column');
    });
  });

  // ==========================================
  // ⚠️ ERROR HANDLING TESTS
  // ==========================================
  describe('⚠️ Error Handling', () => {
    
    it('Should show error when betting with insufficient balance', () => {
      cy.get('[data-testid="bet-amount-input"]').clear().type('999999');
      cy.get('[data-testid="bet-button"]').click();
      
      cy.get('[data-testid="error-toast"]').should('contain', 'Insufficient balance');
    });

    it('Should show error when not logged in', () => {
      cy.clearCookies();
      cy.visit('/games/plinko');
      
      cy.get('[data-testid="bet-button"]').click();
      cy.get('[data-testid="login-prompt"]').should('be.visible');
    });

    it('Should handle network errors gracefully', () => {
      cy.intercept('POST', '**/api/plinko/**', { forceNetworkError: true }).as('networkError');
      
      cy.get('[data-testid="bet-amount-input"]').clear().type('10');
      cy.get('[data-testid="bet-button"]').click();
      
      cy.get('[data-testid="error-toast"]').should('contain', 'Network error');
    });
  });
});
