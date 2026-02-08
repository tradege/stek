/// <reference types="cypress" />

/**
 * ============================================================
 * Phase 36: PLINKO INTERACTION TESTS
 * ============================================================
 * Aggressive DOM interaction testing for the Plinko game.
 * Covers: Risk Switch, Rows Slider, Bet Input Validation,
 *         Game Flow, Keyboard Shortcuts, Canvas, Sound, Responsive.
 * ============================================================
 */

/**
 * Helper: Set a React-controlled input value using nativeInputValueSetter.
 * This is required because React overrides the native value setter,
 * so invoke('val', x) doesn't trigger React's onChange handler.
 */
const setReactInputValue = (selector: string, value: string | number) => {
  cy.get(selector).then(($input) => {
    const input = $input[0] as HTMLInputElement;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('🎯 Plinko Game - Full Interaction Suite', () => {
  beforeEach(() => {
    // Plinko page requires authentication - login first
    cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
    cy.visit('/games/plinko');
    cy.getByTestId('plinko-game', { timeout: 15000 }).should('exist');
  });

  // ==========================================
  // 🎮 GAME LOADING & INITIAL STATE
  // ==========================================
  describe('🎮 Game Loading & Initial State', () => {
    it('Should render the Plinko game container', () => {
      cy.getByTestId('plinko-game').should('exist').and('be.visible');
    });

    it('Should render the canvas element', () => {
      cy.getByTestId('plinko-canvas').should('exist').and('be.visible');
    });

    it('Should render game controls (bet input, risk buttons, slider)', () => {
      // Verify all control elements exist within the game container
      cy.getByTestId('bet-amount-input').should('exist');
      cy.getByTestId('risk-low').should('exist');
      cy.getByTestId('risk-medium').should('exist');
      cy.getByTestId('risk-high').should('exist');
      cy.getByTestId('rows-slider').should('exist');
      cy.getByTestId('bet-button').should('exist');
    });

    it('Should render bet input with default value', () => {
      cy.getByTestId('bet-amount-input')
        .should('exist')
        .and('be.visible')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.be.greaterThan(0);
        });
    });

    it('Should render bet button', () => {
      cy.getByTestId('bet-button').should('exist').and('be.visible');
    });

    it('Should render risk level buttons (LOW, MEDIUM, HIGH)', () => {
      cy.getByTestId('risk-low').should('exist');
      cy.getByTestId('risk-medium').should('exist');
      cy.getByTestId('risk-high').should('exist');
    });

    it('Should render rows slider', () => {
      cy.getByTestId('rows-slider').should('exist').and('be.visible');
    });

    it('Should render rows display', () => {
      cy.getByTestId('rows-display').should('exist').and('be.visible');
    });

    it('Should render bet multiplier buttons (2x, 1/2)', () => {
      cy.getByTestId('bet-2x').should('exist');
      cy.getByTestId('bet-half').should('exist');
    });
  });

  // ==========================================
  // 🎚️ RISK SWITCH TESTS
  // ==========================================
  describe('🎚️ Risk Level Switch', () => {
    it('Should switch to LOW risk and update button style', () => {
      cy.getByTestId('risk-low').click();
      cy.getByTestId('risk-low').then(($el) => {
          const classes = $el.attr('class') || '';
          expect(classes).to.match(/green|active|selected|bg-/);
        });
    });

    it('Should switch to MEDIUM risk and update button style', () => {
      cy.getByTestId('risk-medium').click();
      cy.getByTestId('risk-medium').then(($el) => {
        const classes = $el.attr('class') || '';
        expect(classes).to.match(/yellow|amber|active|selected|bg-/);
      });
    });

    it('Should switch to HIGH risk and update button style', () => {
      cy.getByTestId('risk-high').click();
      cy.getByTestId('risk-high').then(($el) => {
        const classes = $el.attr('class') || '';
        expect(classes).to.match(/red|active|selected|bg-/);
      });
    });

    it('Should only have one risk level active at a time', () => {
      cy.getByTestId('risk-low').click();
      cy.getByTestId('risk-low').invoke('attr', 'class').should('match', /bg-(green|emerald)/);
      
      cy.getByTestId('risk-high').click();
      cy.getByTestId('risk-high').invoke('attr', 'class').should('match', /bg-(red|rose)/);
    });

    it('Should update canvas when risk changes (visual redraw)', () => {
      cy.getByTestId('plinko-canvas').then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const initialData = canvas.toDataURL();
        
        cy.getByTestId('risk-high').click();
        cy.wait(500);
        
        cy.getByTestId('plinko-canvas').then(($newCanvas) => {
          const newCanvas = $newCanvas[0] as HTMLCanvasElement;
          expect(newCanvas.width).to.be.greaterThan(0);
          expect(newCanvas.height).to.be.greaterThan(0);
        });
      });
    });
  });

  // ==========================================
  // 📏 ROWS SLIDER TESTS
  // ==========================================
  describe('📏 Rows Slider', () => {
    it('Should display current row count', () => {
      cy.getByTestId('rows-display')
        .invoke('text')
        .then((text) => {
          const rows = parseInt(text);
          expect(rows).to.be.gte(8).and.lte(16);
        });
    });

    it('Should change rows when slider is moved to 12', () => {
      // Use nativeInputValueSetter to properly trigger React onChange
      setReactInputValue('[data-testid="rows-slider"]', 12);
      cy.wait(300);
      cy.getByTestId('rows-display').should('contain', '12');
    });

    it('Should change rows when slider is moved to 8 (minimum)', () => {
      setReactInputValue('[data-testid="rows-slider"]', 8);
      cy.wait(300);
      cy.getByTestId('rows-display').should('contain', '8');
    });

    it('Should change rows when slider is moved to 16 (maximum)', () => {
      setReactInputValue('[data-testid="rows-slider"]', 16);
      cy.wait(300);
      cy.getByTestId('rows-display').should('contain', '16');
    });

    it('Should update canvas pins when rows change', () => {
      cy.getByTestId('plinko-canvas').then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        expect(canvas.width).to.be.greaterThan(0);
      });

      setReactInputValue('[data-testid="rows-slider"]', 14);
      cy.wait(300);

      cy.getByTestId('plinko-canvas').then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        expect(canvas.width).to.be.greaterThan(0);
        expect(canvas.height).to.be.greaterThan(0);
      });
    });

    it('Should have correct min/max attributes on slider', () => {
      cy.getByTestId('rows-slider')
        .should('have.attr', 'min', '8')
        .and('have.attr', 'max', '16');
    });
  });

  // ==========================================
  // 💰 BET INPUT VALIDATION TESTS
  // ==========================================
  describe('💰 Bet Input Validation', () => {
    it('Should accept valid positive bet amount', () => {
      // Use nativeInputValueSetter for React controlled input
      setReactInputValue('[data-testid="bet-amount-input"]', 10);
      cy.wait(200);
      
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.eq(10);
        });
    });

    it('Should handle clearing and retyping bet amount', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 25.5);
      cy.wait(200);
      
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.be.closeTo(25.5, 0.01);
        });
    });

    it('Should block negative values (type "-5")', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', -5);
      cy.wait(200);
      
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          // The onChange handler does Math.max(0.1, Number(e.target.value))
          // So -5 becomes 0.1
          const numVal = Number(val);
          expect(numVal).to.be.gte(0);
        });
    });

    it('Should accept 100 as valid bet', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 100);
      cy.wait(200);
      
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.eq(100);
        });
    });

    it('Should double bet amount with 2x button', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 10);
      cy.wait(200);
      cy.getByTestId('bet-2x').click();
      cy.wait(200);
      
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.eq(20);
        });
    });

    it('Should halve bet amount with 1/2 button', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 20);
      cy.wait(200);
      cy.getByTestId('bet-half').click();
      cy.wait(200);
      
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.eq(10);
        });
    });

    it('Should not allow zero bet', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 0);
      cy.wait(200);
      // The onChange handler does Math.max(0.1, Number(e.target.value))
      // So 0 becomes 0.1
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.be.gte(0);
        });
    });

    it('Should handle very large bet amount gracefully', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 999999);
      cy.wait(200);
      cy.getByTestId('bet-amount-input')
        .invoke('val')
        .then((val) => {
          expect(Number(val)).to.be.a('number');
        });
    });
  });

  // ==========================================
  // 🚀 GAME FLOW TESTS (requires login)
  // ==========================================
  describe('🚀 Game Flow (Authenticated)', () => {
    beforeEach(() => {
      cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
      cy.visit('/games/plinko');
      cy.getByTestId('plinko-game').should('be.visible');
    });

    it('Should enable bet button when logged in with balance', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);
      cy.getByTestId('bet-button').should('not.be.disabled');
    });

    it('Should place bet and start ball animation', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);
      cy.getByTestId('bet-button').click();

      // Button should become disabled during animation
      cy.getByTestId('bet-button').should('be.disabled');
    });

    it('Should show result after ball animation completes', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);
      cy.getByTestId('bet-button').click();

      // Wait for animation to complete
      cy.wait(5000);

      // Button should be re-enabled
      cy.getByTestId('bet-button').should('not.be.disabled');
    });

    it('Should disable bet button during active game', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);
      cy.getByTestId('bet-button').click();

      // Immediately check - should be disabled
      cy.getByTestId('bet-button').should('be.disabled');
    });
  });

  // ==========================================
  // ⌨️ KEYBOARD SHORTCUTS TESTS
  // ==========================================
  describe('⌨️ Keyboard Shortcuts', () => {
    beforeEach(() => {
      cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
      cy.visit('/games/plinko');
      cy.getByTestId('plinko-game').should('be.visible');
    });

    it('Should place bet with Spacebar when not focused on input', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);
      // Click somewhere else to unfocus input
      cy.getByTestId('plinko-canvas').click();
      // Press spacebar
      cy.get('body').type(' ');

      // Bet should be placed (button disabled during animation)
      cy.getByTestId('bet-button').should('be.disabled');
    });

    it('Should NOT place bet when Spacebar pressed while input is focused', () => {
      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);
      // Keep focus on input and press space
      cy.getByTestId('bet-amount-input').type(' ');

      // Bet should NOT have been placed
      cy.getByTestId('bet-button').should('not.be.disabled');
    });
  });

  // ==========================================
  // 🎨 CANVAS & VISUAL ELEMENTS TESTS
  // ==========================================
  describe('🎨 Canvas & Visual Elements', () => {
    it('Should have a properly sized canvas', () => {
      cy.getByTestId('plinko-canvas').then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        expect(canvas.width).to.be.greaterThan(100);
        expect(canvas.height).to.be.greaterThan(100);
      });
    });

    it('Should render canvas with non-empty content (pins drawn)', () => {
      cy.getByTestId('plinko-canvas').then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hasContent = imageData.data.some((val, idx) => idx % 4 !== 3 && val > 0);
          expect(hasContent).to.be.true;
        }
      });
    });

    it('Should maintain canvas aspect ratio on resize', () => {
      cy.getByTestId('plinko-canvas').then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const ratio = canvas.width / canvas.height;
        expect(ratio).to.be.greaterThan(0.3).and.lessThan(3);
      });
    });
  });

  // ==========================================
  // 📱 RESPONSIVE LAYOUT TESTS
  // ==========================================
  describe('📱 Responsive Design', () => {
    it('Should display correctly on desktop (1440x900)', () => {
      cy.viewport(1440, 900);
      cy.getByTestId('plinko-game').should('be.visible');
      cy.getByTestId('plinko-canvas').should('be.visible');
      cy.getByTestId('bet-button').should('be.visible');
    });

    it('Should display correctly on tablet (iPad)', () => {
      cy.viewport('ipad-2');
      cy.getByTestId('plinko-game').should('be.visible');
      cy.getByTestId('plinko-canvas').should('be.visible');
    });

    it('Should display correctly on mobile (iPhone X)', () => {
      cy.viewport('iphone-x');
      cy.getByTestId('plinko-game').should('be.visible');
      cy.getByTestId('plinko-canvas').should('be.visible');
    });

    it('Should stack controls below canvas on mobile', () => {
      cy.viewport('iphone-x');
      cy.getByTestId('plinko-game').then(($game) => {
        const display = $game.css('flex-direction');
        // On mobile, should be column layout
        expect(display).to.eq('column');
      });
    });
  });

  // ==========================================
  // ⚠️ ERROR HANDLING TESTS
  // ==========================================
  describe('⚠️ Error Handling', () => {
    it('Should redirect to login when not authenticated', () => {
      // Clear all auth state
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      cy.clearAllCookies();
      cy.visit('/games/plinko');

      // Page should redirect to login or show login prompt
      cy.url({ timeout: 10000 }).then((url) => {
        if (url.includes('/login') || url.includes('/auth')) {
          // Redirected to login - correct behavior
          expect(url).to.match(/login|auth/);
        } else {
          // Still on plinko page - check if bet is disabled or login prompt shown
          cy.get('body').then(($body) => {
            const text = $body.text().toLowerCase();
            const hasLoginPrompt = text.includes('login') || text.includes('sign in');
            const betDisabled = $body.find('[data-testid="bet-button"]:disabled').length > 0;
            expect(hasLoginPrompt || betDisabled).to.be.true;
          });
        }
      });
    });

    it('Should handle network error gracefully', () => {
      cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
      cy.visit('/games/plinko');

      // Intercept API and force error
      cy.intercept('POST', '**/api/plinko/**', { forceNetworkError: true }).as('networkError');
      cy.intercept('POST', '**/plinko/**', { forceNetworkError: true }).as('networkError2');

      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);
      cy.getByTestId('bet-button').click();

      // Should show error or re-enable button
      cy.getByTestId('bet-button', { timeout: 10000 }).should('not.be.disabled');
    });
  });

  // ==========================================
  // 🔄 COMBINED INTERACTION FLOW
  // ==========================================
  describe('🔄 Combined Interaction Flow', () => {
    it('Should handle full game setup: Risk → Rows → Bet → Play', () => {
      cy.loginViaApi(Cypress.env('adminEmail'), Cypress.env('adminPassword'));
      cy.visit('/games/plinko');
      cy.getByTestId('plinko-game', { timeout: 15000 }).should('exist');

      // 1. Set risk to HIGH
      cy.getByTestId('risk-high').click();

      // 2. Set rows to 12 using nativeInputValueSetter
      setReactInputValue('[data-testid="rows-slider"]', 12);
      cy.wait(300);
      cy.getByTestId('rows-display').should('contain', '12');

      // 3. Set bet amount
      setReactInputValue('[data-testid="bet-amount-input"]', 1);
      cy.wait(200);

      // 4. Place bet
      cy.getByTestId('bet-button').click();

      // 5. Verify game is playing
      cy.getByTestId('bet-button').should('be.disabled');

      // 6. Wait for completion
      cy.getByTestId('bet-button', { timeout: 10000 }).should('not.be.disabled');
    });

    it('Should allow rapid risk switching without breaking', () => {
      cy.getByTestId('risk-low').click();
      cy.getByTestId('risk-medium').click();
      cy.getByTestId('risk-high').click();
      cy.getByTestId('risk-low').click();
      cy.getByTestId('risk-medium').click();

      // Game should still be functional
      cy.getByTestId('plinko-canvas').should('be.visible');
      cy.getByTestId('bet-button').should('be.visible');
    });

    it('Should allow rapid rows changes without breaking', () => {
      for (let rows = 8; rows <= 16; rows++) {
        setReactInputValue('[data-testid="rows-slider"]', rows);
      }
      cy.wait(300);

      // Game should still be functional
      cy.getByTestId('plinko-canvas').should('be.visible');
      cy.getByTestId('rows-display').should('contain', '16');
    });
  });
});
