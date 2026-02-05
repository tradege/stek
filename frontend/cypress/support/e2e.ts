/// <reference types="cypress" />

// ***********************************************
// Custom Commands for StakePro E2E Testing
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login to the application
       * @param email - User email
       * @param password - User password
       */
      login(email: string, password: string): Chainable<void>;
      
      /**
       * Logout from the application
       */
      logout(): Chainable<void>;
      
      /**
       * Deposit funds to wallet
       * @param amount - Amount to deposit
       * @param currency - Currency type (default: USDT)
       */
      deposit(amount: number, currency?: string): Chainable<void>;
      
      /**
       * Navigate to a game
       * @param game - Game name (crash, plinko, etc.)
       */
      goToGame(game: string): Chainable<void>;
      
      /**
       * Place a bet
       * @param amount - Bet amount
       */
      placeBet(amount: number): Chainable<void>;
      
      /**
       * Wait for socket connection
       */
      waitForSocket(): Chainable<void>;
      
      /**
       * Check toast notification
       * @param message - Expected message
       */
      checkToast(message: string): Chainable<void>;
      
      /**
       * Get by data-testid
       * @param testId - The data-testid value
       */
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

// ==========================================
// LOGIN COMMAND
// ==========================================
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/auth/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('not.include', '/auth/login');
  });
});

// ==========================================
// LOGOUT COMMAND
// ==========================================
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-button"]').click();
  cy.url().should('include', '/auth/login');
});

// ==========================================
// DEPOSIT COMMAND
// ==========================================
Cypress.Commands.add('deposit', (amount: number, currency = 'USDT') => {
  cy.get('[data-testid="wallet-button"]').click();
  cy.get('[data-testid="deposit-tab"]').click();
  cy.get(`[data-testid="currency-${currency}"]`).click();
  cy.get('[data-testid="deposit-amount"]').type(amount.toString());
  cy.get('[data-testid="deposit-submit"]').click();
  cy.get('[data-testid="deposit-address"]').should('be.visible');
});

// ==========================================
// GO TO GAME COMMAND
// ==========================================
Cypress.Commands.add('goToGame', (game: string) => {
  cy.visit(`/games/${game}`);
  cy.get('[data-testid="game-canvas"]', { timeout: 10000 }).should('be.visible');
});

// ==========================================
// PLACE BET COMMAND
// ==========================================
Cypress.Commands.add('placeBet', (amount: number) => {
  cy.get('[data-testid="bet-amount-input"]').clear().type(amount.toString());
  cy.get('[data-testid="bet-button"]').click();
});

// ==========================================
// WAIT FOR SOCKET CONNECTION
// ==========================================
Cypress.Commands.add('waitForSocket', () => {
  cy.get('[data-testid="connection-status"]', { timeout: 15000 })
    .should('have.attr', 'data-connected', 'true');
});

// ==========================================
// CHECK TOAST NOTIFICATION
// ==========================================
Cypress.Commands.add('checkToast', (message: string) => {
  cy.get('[data-testid="toast"]', { timeout: 5000 })
    .should('be.visible')
    .and('contain', message);
});

// ==========================================
// GET BY TEST ID
// ==========================================
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

// ==========================================
// GLOBAL BEFORE EACH
// ==========================================
beforeEach(() => {
  // Clear local storage before each test
  cy.clearLocalStorage();
  
  // Intercept API calls for mocking
  cy.intercept('GET', '**/api/**').as('apiCall');
});

// ==========================================
// GLOBAL AFTER EACH
// ==========================================
afterEach(() => {
  // Take screenshot on failure
  cy.screenshot({ capture: 'runner' });
});

export {};
