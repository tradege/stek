/// <reference types="cypress" />

// ***********************************************
// StakePro E2E Custom Commands
// Phase 36: Pixel Perfect Testing
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /** Login via the /login page */
      login(email: string, password: string): Chainable<void>;

      /** Login via API (faster, no UI) */
      loginViaApi(email: string, password: string): Chainable<void>;

      /** Logout */
      logout(): Chainable<void>;

      /** Navigate to a game page */
      goToGame(game: string): Chainable<void>;

      /** Place a bet with given amount */
      placeBet(amount: number): Chainable<void>;

      /** Wait for WebSocket connection indicator */
      waitForSocket(): Chainable<void>;

      /** Assert a toast notification appears */
      checkToast(message: string): Chainable<void>;

      /** Shorthand for cy.get(`[data-testid="..."]`) */
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;

      /** Open the Wallet modal from sidebar */
      openWallet(): Chainable<void>;

      /** Open the Chat sidebar */
      openChat(): Chainable<void>;

      /** Open the Settings modal */
      openSettings(): Chainable<void>;

      /** Open the Statistics modal */
      openStatistics(): Chainable<void>;
    }
  }
}

// ==========================================
// GET BY TEST ID (most used helper)
// ==========================================
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

// ==========================================
// LOGIN COMMAND (UI-based)
// ==========================================
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="login-email"]').clear().type(email);
    cy.get('[data-testid="login-password"]').clear().type(password);
    cy.get('[data-testid="login-submit"]').click();
    // Wait for redirect to home
    cy.url().should('not.include', '/login', { timeout: 10000 });
  });
});

// ==========================================
// LOGIN VIA API (faster for test setup)
// ==========================================
Cypress.Commands.add('loginViaApi', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/auth/login`,
      body: { email, password },
    }).then((resp) => {
      expect(resp.status).to.be.oneOf([200, 201]);
      const token = resp.body.token || resp.body.access_token;
      if (token) {
        window.localStorage.setItem('token', token);
        window.localStorage.setItem('auth_token', token);
      }
    });
  });
});

// ==========================================
// LOGOUT COMMAND
// ==========================================
Cypress.Commands.add('logout', () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('auth_token');
  });
  cy.visit('/');
});

// ==========================================
// GO TO GAME
// ==========================================
Cypress.Commands.add('goToGame', (game: string) => {
  cy.visit(`/games/${game}`);
  cy.url().should('include', `/games/${game}`);
});

// ==========================================
// PLACE BET
// ==========================================
Cypress.Commands.add('placeBet', (amount: number) => {
  cy.getByTestId('bet-amount-input').clear().type(amount.toString());
  cy.getByTestId('bet-button').click();
});

// ==========================================
// WAIT FOR SOCKET
// ==========================================
Cypress.Commands.add('waitForSocket', () => {
  cy.getByTestId('connection-status', { timeout: 15000 })
    .should('exist');
});

// ==========================================
// CHECK TOAST
// ==========================================
Cypress.Commands.add('checkToast', (message: string) => {
  cy.get('.toast, [role="alert"], [data-testid="toast"]', { timeout: 5000 })
    .should('be.visible')
    .and('contain', message);
});

// ==========================================
// OPEN WALLET MODAL
// ==========================================
Cypress.Commands.add('openWallet', () => {
  cy.getByTestId('nav-wallet').click();
  cy.getByTestId('wallet-modal').should('be.visible');
});

// ==========================================
// OPEN CHAT
// ==========================================
Cypress.Commands.add('openChat', () => {
  cy.getByTestId('nav-chat').click();
});

// ==========================================
// OPEN SETTINGS
// ==========================================
Cypress.Commands.add('openSettings', () => {
  cy.getByTestId('nav-settings').click();
  cy.getByTestId('settings-modal').should('be.visible');
});

// ==========================================
// OPEN STATISTICS
// ==========================================
Cypress.Commands.add('openStatistics', () => {
  cy.getByTestId('nav-stats').click();
  cy.getByTestId('statistics-modal').should('be.visible');
});

// ==========================================
// GLOBAL HOOKS
// ==========================================
beforeEach(() => {
  // Suppress uncaught exceptions from the app (WebSocket errors, etc.)
  cy.on('uncaught:exception', (err) => {
    // Ignore WebSocket and network errors during testing
    if (
      err.message.includes('WebSocket') ||
      err.message.includes('socket') ||
      err.message.includes('Network Error') ||
      err.message.includes('ResizeObserver') ||
      err.message.includes('hydrat')
    ) {
      return false;
    }
    // Let other errors fail the test
    return true;
  });
});

export {};
