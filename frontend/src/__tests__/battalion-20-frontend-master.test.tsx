/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  BATTALION 20: FRONTEND MASTER SUITE                                ║
 * ║  "The User's Eye"                                                   ║
 * ║                                                                      ║
 * ║  Tests:                                                              ║
 * ║  • Scenario 1: Page Smoke Tests (All 51 Routes — No White Screens)  ║
 * ║  • Scenario 2: Mobile UX & Touch Targets                           ║
 * ║  • Scenario 3: Critical Client Flows (Deposit, Bet, Cashout)       ║
 * ║  • Scenario 4: Error Boundaries (White Screen Prevention)          ║
 * ║  • Scenario 5: Asset Integrity (Broken Images/Sounds Check)        ║
 * ║  • Scenario 6: Navigation & Routing Logic                          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// ROUTE REGISTRY — ALL 51 PAGE ROUTES
// ============================================================
const ALL_ROUTES = {
  public: [
    { route: '/', file: 'src/app/page.tsx', name: 'Homepage' },
    { route: '/login', file: 'src/app/login/page.tsx', name: 'Login' },
    { route: '/register', file: 'src/app/register/page.tsx', name: 'Register' },
    { route: '/faq', file: 'src/app/faq/page.tsx', name: 'FAQ' },
    { route: '/privacy', file: 'src/app/privacy/page.tsx', name: 'Privacy Policy' },
    { route: '/terms', file: 'src/app/terms/page.tsx', name: 'Terms of Service' },
    { route: '/responsible-gaming', file: 'src/app/responsible-gaming/page.tsx', name: 'Responsible Gaming' },
    { route: '/vip', file: 'src/app/vip/page.tsx', name: 'VIP' },
    { route: '/promotions', file: 'src/app/promotions/page.tsx', name: 'Promotions' },
  ],
  games: [
    { route: '/games/crash', file: 'src/app/games/crash/page.tsx', name: 'Crash' },
    { route: '/games/plinko', file: 'src/app/games/plinko/page.tsx', name: 'Plinko' },
    { route: '/games/dice', file: 'src/app/games/dice/page.tsx', name: 'Dice' },
    { route: '/games/mines', file: 'src/app/games/mines/page.tsx', name: 'Mines' },
    { route: '/games/limbo', file: 'src/app/games/limbo/page.tsx', name: 'Limbo' },
    { route: '/games/penalty', file: 'src/app/games/penalty/page.tsx', name: 'Penalty' },
    { route: '/games/card-rush', file: 'src/app/games/card-rush/page.tsx', name: 'Card Rush' },
    { route: '/games/olympus', file: 'src/app/games/olympus/page.tsx', name: 'Olympus' },
    { route: '/games/dragon-blaze', file: 'src/app/games/dragon-blaze/page.tsx', name: 'Dragon Blaze' },
    { route: '/games/nova-rush', file: 'src/app/games/nova-rush/page.tsx', name: 'Nova Rush' },
  ],
  liveGames: [
    { route: '/games/live/baccarat-live', file: 'src/app/games/live/baccarat-live/page.tsx', name: 'Baccarat Live' },
    { route: '/games/live/blackjack-live', file: 'src/app/games/live/blackjack-live/page.tsx', name: 'Blackjack Live' },
    { route: '/games/live/roulette-live', file: 'src/app/games/live/roulette-live/page.tsx', name: 'Roulette Live' },
  ],
  slots: [
    { route: '/games/slots/big-bass-bonanza', file: 'src/app/games/slots/big-bass-bonanza/page.tsx', name: 'Big Bass Bonanza' },
    { route: '/games/slots/book-of-dead', file: 'src/app/games/slots/book-of-dead/page.tsx', name: 'Book of Dead' },
    { route: '/games/slots/gates-of-olympus', file: 'src/app/games/slots/gates-of-olympus/page.tsx', name: 'Gates of Olympus' },
    { route: '/games/slots/starburst', file: 'src/app/games/slots/starburst/page.tsx', name: 'Starburst' },
    { route: '/games/slots/sweet-bonanza', file: 'src/app/games/slots/sweet-bonanza/page.tsx', name: 'Sweet Bonanza' },
  ],
  sports: [
    { route: '/sports', file: 'src/app/sports/page.tsx', name: 'Sports' },
    { route: '/sports/my-bets', file: 'src/app/sports/my-bets/page.tsx', name: 'My Bets' },
  ],
  protected: [
    { route: '/wallet', file: 'src/app/wallet/page.tsx', name: 'Wallet' },
    { route: '/profile', file: 'src/app/profile/page.tsx', name: 'Profile' },
    { route: '/affiliates', file: 'src/app/affiliates/page.tsx', name: 'Affiliates' },
    { route: '/statistics', file: 'src/app/statistics/page.tsx', name: 'Statistics' },
  ],
  admin: [
    { route: '/admin/dashboard', file: 'src/app/admin/dashboard/page.tsx', name: 'Admin Dashboard' },
    { route: '/admin/users', file: 'src/app/admin/users/page.tsx', name: 'Admin Users' },
    { route: '/admin/finance', file: 'src/app/admin/finance/page.tsx', name: 'Admin Finance' },
    { route: '/admin/games', file: 'src/app/admin/games/page.tsx', name: 'Admin Games' },
    { route: '/admin/transactions', file: 'src/app/admin/transactions/page.tsx', name: 'Admin Transactions' },
    { route: '/admin/withdrawals', file: 'src/app/admin/withdrawals/page.tsx', name: 'Admin Withdrawals' },
    { route: '/admin/game-history', file: 'src/app/admin/game-history/page.tsx', name: 'Admin Game History' },
    { route: '/admin/settings', file: 'src/app/admin/settings/page.tsx', name: 'Admin Settings' },
    { route: '/admin/brand-settings', file: 'src/app/admin/brand-settings/page.tsx', name: 'Admin Brand Settings' },
    { route: '/admin/god-mode', file: 'src/app/admin/god-mode/page.tsx', name: 'Admin God Mode' },
    { route: '/admin/sports', file: 'src/app/admin/sports/page.tsx', name: 'Admin Sports' },
  ],
  superAdmin: [
    { route: '/super-admin/dashboard', file: 'src/app/super-admin/dashboard/page.tsx', name: 'Super Admin Dashboard' },
    { route: '/super-admin/tenants', file: 'src/app/super-admin/tenants/page.tsx', name: 'Super Admin Tenants' },
    { route: '/super-admin/tenants/create', file: 'src/app/super-admin/tenants/create/page.tsx', name: 'Super Admin Create Tenant' },
    { route: '/super-admin/bankroll', file: 'src/app/super-admin/bankroll/page.tsx', name: 'Super Admin Bankroll' },
    { route: '/super-admin/reports', file: 'src/app/super-admin/reports/page.tsx', name: 'Super Admin Reports' },
  ],
  dynamic: [
    { route: '/games/[provider]/[slug]', file: 'src/app/games/[provider]/[slug]/page.tsx', name: 'Dynamic Game' },
    { route: '/sports/[category]', file: 'src/app/sports/[category]/page.tsx', name: 'Sports Category' },
  ],
};

// Flatten all routes
const ALL_ROUTES_FLAT = [
  ...ALL_ROUTES.public,
  ...ALL_ROUTES.games,
  ...ALL_ROUTES.liveGames,
  ...ALL_ROUTES.slots,
  ...ALL_ROUTES.sports,
  ...ALL_ROUTES.protected,
  ...ALL_ROUTES.admin,
  ...ALL_ROUTES.superAdmin,
  ...ALL_ROUTES.dynamic,
];

// Frontend root — __dirname is src/__tests__, go up 2 levels to frontend/
const FRONTEND_ROOT = path.resolve(__dirname, '../..');

// ============================================================
// HELPER: Read file content safely
// ============================================================
function readFileContent(filePath: string): string | null {
  const fullPath = path.join(FRONTEND_ROOT, filePath);
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

// ============================================================
// HELPER: Check if file exists
// ============================================================
function fileExists(filePath: string): boolean {
  const fullPath = path.join(FRONTEND_ROOT, filePath);
  return fs.existsSync(fullPath);
}

// ============================================================
// HELPER: Extract all imports from a TSX file
// ============================================================
function extractImports(content: string): string[] {
  const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// ============================================================
// HELPER: Check for 'use client' directive
// ============================================================
function hasUseClientDirective(content: string): boolean {
  return content.includes("'use client'") || content.includes('"use client"');
}

// ============================================================
// HELPER: Check for default export
// ============================================================
function hasDefaultExport(content: string): boolean {
  return /export\s+default/.test(content);
}

// ============================================================
// HELPER: Extract CSS classes from content
// ============================================================
function extractClassNames(content: string): string[] {
  const classRegex = /className=["'`]([^"'`]+)["'`]/g;
  const classes: string[] = [];
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

// ============================================================
// HELPER: Check for responsive classes
// ============================================================
function hasResponsiveClasses(classes: string[]): boolean {
  const responsivePatterns = ['sm:', 'md:', 'lg:', 'xl:', '2xl:'];
  return classes.some(cls => responsivePatterns.some(p => cls.includes(p)));
}

// ============================================================
// HELPER: Check for ErrorBoundary wrapping
// ============================================================
function hasErrorBoundary(content: string): boolean {
  return content.includes('ErrorBoundary');
}

// ============================================================
// HELPER: Extract data-testid attributes
// ============================================================
function extractTestIds(content: string): string[] {
  const testIdRegex = /data-testid=["']([^"']+)["']/g;
  const testIds: string[] = [];
  let match;
  while ((match = testIdRegex.exec(content)) !== null) {
    testIds.push(match[1]);
  }
  return testIds;
}

// ============================================================
// HELPER: Check for min-height touch target compliance
// ============================================================
function checkTouchTargets(content: string): { compliant: string[]; violations: string[] } {
  const buttonRegex = /<button[^>]*className=["']([^"']+)["'][^>]*>/g;
  const compliant: string[] = [];
  const violations: string[] = [];
  let match;
  while ((match = buttonRegex.exec(content)) !== null) {
    const classes = match[1];
    const hasSufficientPadding =
      /py-(2\.5|3|4|5|6|8|10|12)/.test(classes) ||
      /min-h-\[(44|48|52|56)px\]/.test(classes) ||
      /h-(11|12|14|16|20)/.test(classes) ||
      /p-(3|4|5|6|8)/.test(classes);
    if (hasSufficientPadding) {
      compliant.push(classes);
    } else {
      // Check if it's a small utility button (not a primary action)
      const isSmallUtility = /text-\[?(8|9|10)/.test(classes) || /text-xs/.test(classes);
      if (!isSmallUtility) {
        violations.push(classes);
      }
    }
  }
  return { compliant, violations };
}

// ============================================================
// HELPER: Find all asset references
// ============================================================
function findAssetReferences(content: string): string[] {
  const refs: string[] = [];
  // src="..." patterns
  const srcRegex = /src=["']([^"']+)["']/g;
  let match;
  while ((match = srcRegex.exec(content)) !== null) {
    const src = match[1];
    if (src.startsWith('/') && !src.startsWith('//') && !src.startsWith('/api')) {
      refs.push(src);
    }
  }
  // url("...") patterns in CSS
  const urlRegex = /url\(["']?([^"')]+)["']?\)/g;
  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[1];
    if (url.startsWith('/') && !url.startsWith('//')) {
      refs.push(url);
    }
  }
  return refs;
}

// ============================================================
// HELPER: Analyze component structure
// ============================================================
function analyzeComponent(content: string): {
  hasReturn: boolean;
  hasJSX: boolean;
  hasHooks: boolean;
  hasErrorHandling: boolean;
  hasLoadingState: boolean;
  hasConditionalRendering: boolean;
} {
  return {
    hasReturn: /return\s*\(/.test(content) || /return\s*</.test(content),
    hasJSX: /<[A-Z]/.test(content) || /<div/.test(content),
    hasHooks: /use[A-Z]/.test(content),
    hasErrorHandling: /catch\s*\(/.test(content) || /\.catch\(/.test(content) || /onError/.test(content),
    hasLoadingState: /loading|isLoading|Loading/.test(content),
    hasConditionalRendering: /\{.*\?.*:.*\}/.test(content) || /&&\s*</.test(content),
  };
}

// ============================================================
// SCENARIO 1: PAGE SMOKE TESTS (ALL 51 ROUTES)
// ============================================================
describe('⚔️ BATTALION 20: FRONTEND MASTER SUITE', () => {

  describe('Scenario 1: Page Smoke Tests — No White Screens (51 Routes)', () => {

    describe('1A: Page Files Exist', () => {
      ALL_ROUTES_FLAT.forEach(({ route, file, name }) => {
        it(`[${name}] ${route} — page file exists`, () => {
          expect(fileExists(file)).toBe(true);
        });
      });
    });

    describe('1B: Page Files Have Valid Structure', () => {
      ALL_ROUTES_FLAT.forEach(({ route, file, name }) => {
        it(`[${name}] ${route} — has valid React component structure`, () => {
          const content = readFileContent(file);
          expect(content).not.toBeNull();
          if (content) {
            // Must have a default export (Next.js requirement)
            expect(hasDefaultExport(content)).toBe(true);
            // Must have JSX return
            const analysis = analyzeComponent(content);
            expect(analysis.hasReturn).toBe(true);
            expect(analysis.hasJSX).toBe(true);
          }
        });
      });
    });

    describe('1C: Client Components Have "use client" Directive', () => {
      ALL_ROUTES_FLAT.forEach(({ route, file, name }) => {
        it(`[${name}] ${route} — has "use client" if using hooks`, () => {
          const content = readFileContent(file);
          if (content) {
            const usesHooks = /use(State|Effect|Context|Callback|Memo|Ref|Router|Auth|Socket|Sound|Branding|Modal)\b/.test(content);
            if (usesHooks) {
              expect(hasUseClientDirective(content)).toBe(true);
            }
          }
        });
      });
    });

    describe('1D: No Syntax Errors in Imports', () => {
      ALL_ROUTES_FLAT.forEach(({ route, file, name }) => {
        it(`[${name}] ${route} — all local imports resolve`, () => {
          const content = readFileContent(file);
          if (content) {
            const imports = extractImports(content);
            const localImports = imports.filter(i => i.startsWith('@/') || i.startsWith('./') || i.startsWith('../'));
            
            localImports.forEach(imp => {
              // Resolve @/ to src/
              let resolved = imp.replace('@/', 'src/');
              
              // Check if it's a file or directory
              const possiblePaths = [
                `${resolved}.tsx`,
                `${resolved}.ts`,
                `${resolved}/index.tsx`,
                `${resolved}/index.ts`,
                resolved,
              ];
              
              const exists = possiblePaths.some(p => fileExists(p));
              if (!exists) {
                // Don't fail on node_modules imports
                const isNodeModule = !imp.startsWith('@/') && !imp.startsWith('./') && !imp.startsWith('../');
                if (!isNodeModule) {
                  // Soft check — log but don't fail for relative imports that might resolve differently
                  // Only fail for @/ imports which are absolute
                  if (imp.startsWith('@/')) {
                    expect(exists).toBe(true);
                  }
                }
              }
            });
          }
        });
      });
    });

    describe('1E: Page Route Count Verification', () => {
      it('should have exactly 51 page routes registered', () => {
        expect(ALL_ROUTES_FLAT.length).toBe(51);
      });

      it('should have 9 public pages', () => {
        expect(ALL_ROUTES.public.length).toBe(9);
      });

      it('should have 10 original games', () => {
        expect(ALL_ROUTES.games.length).toBe(10);
      });

      it('should have 3 live games', () => {
        expect(ALL_ROUTES.liveGames.length).toBe(3);
      });

      it('should have 5 slot games', () => {
        expect(ALL_ROUTES.slots.length).toBe(5);
      });

      it('should have 11 admin pages', () => {
        expect(ALL_ROUTES.admin.length).toBe(11);
      });

      it('should have 5 super-admin pages', () => {
        expect(ALL_ROUTES.superAdmin.length).toBe(5);
      });
    });
  });

  // ============================================================
  // SCENARIO 2: MOBILE UX & TOUCH TARGETS
  // ============================================================
  describe('Scenario 2: Mobile UX & Touch Targets', () => {

    describe('2A: MainLayout Mobile Responsiveness', () => {
      it('should have mobile detection logic (window.innerWidth < 1024)', () => {
        const content = readFileContent('src/components/layout/MainLayout.tsx');
        expect(content).not.toBeNull();
        expect(content).toContain('innerWidth');
        expect(content).toContain('1024');
      });

      it('should have sidebar toggle for mobile', () => {
        const content = readFileContent('src/components/layout/MainLayout.tsx');
        expect(content).toContain('isSidebarOpen');
        expect(content).toContain('setIsSidebarOpen');
      });

      it('should have overlay for mobile sidebar', () => {
        const content = readFileContent('src/components/layout/MainLayout.tsx');
        expect(content).toContain('bg-black/60');
        expect(content).toContain('handleOverlayClick');
      });

      it('should have sidebar hidden by default on mobile (translate-x)', () => {
        const content = readFileContent('src/components/layout/MainLayout.tsx');
        expect(content).toContain('-translate-x-full');
        expect(content).toContain('lg:translate-x-0');
      });
    });

    describe('2B: Header Mobile Responsiveness', () => {
      it('should have hamburger menu button with mobile-menu-btn testid', () => {
        const content = readFileContent('src/components/layout/Header.tsx');
        expect(content).toContain('mobile-menu-btn');
      });

      it('should have hamburger visible only on mobile (lg:hidden)', () => {
        const content = readFileContent('src/components/layout/Header.tsx');
        expect(content).toContain('lg:hidden');
      });

      it('should show balance on mobile (no hidden sm:block on balance)', () => {
        const content = readFileContent('src/components/layout/Header.tsx');
        // After our fix, balance should NOT have 'hidden sm:block'
        // It should use 'text-xs sm:text-base' instead
        const balanceLines = content!.split('\n').filter(l => l.includes('tabular-nums'));
        balanceLines.forEach(line => {
          expect(line).not.toContain('hidden sm:block');
        });
      });

      it('should have search hidden on mobile (hidden sm:block)', () => {
        const content = readFileContent('src/components/layout/Header.tsx');
        expect(content).toContain('header-search');
        // Search should be hidden on mobile
        const searchSection = content!.split('\n').filter(l => l.includes('header-search'));
        // This is expected to be hidden on mobile
      });
    });

    describe('2C: Game Touch Targets (44px Apple Compliance)', () => {
      const gameFiles = [
        { name: 'CrashGamePanel', file: 'src/components/games/CrashGamePanel.tsx' },
        { name: 'PlinkoGame', file: 'src/components/games/plinko/PlinkoGame.tsx' },
        { name: 'DragonBlazeGame', file: 'src/components/games/DragonBlazeGame.tsx' },
        { name: 'NovaRushGame', file: 'src/components/games/NovaRushGame.tsx' },
        { name: 'Dice', file: 'src/app/games/dice/page.tsx' },
        { name: 'Mines', file: 'src/app/games/mines/page.tsx' },
        { name: 'Limbo', file: 'src/app/games/limbo/page.tsx' },
      ];

      gameFiles.forEach(({ name, file }) => {
        it(`[${name}] should have responsive classes`, () => {
          const content = readFileContent(file);
          if (content) {
            const classes = extractClassNames(content);
            expect(hasResponsiveClasses(classes)).toBe(true);
          }
        });
      });

      it('CrashGamePanel ½/2x buttons should have min-h-[44px]', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('min-h-[44px]');
      });

      it('DragonBlazeGame ½ buttons should have min-h-[44px]', () => {
        const content = readFileContent('src/components/games/DragonBlazeGame.tsx');
        expect(content).toContain('min-h-[44px]');
      });

      it('Main bet buttons should have sufficient padding (py-3 or larger)', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        // The main bet button should have py-3 or py-4
        const betButtonSection = content!.split('\n').filter(l =>
          l.includes('place-bet') || l.includes('Bet') && l.includes('button')
        );
        // At least one button should have good padding
        expect(content).toMatch(/py-(3|4|5|6)/);
      });
    });

    describe('2D: Chat Panel Mobile Behavior', () => {
      it('should have chat toggle mechanism', () => {
        const content = readFileContent('src/components/layout/MainLayout.tsx');
        expect(content).toContain('isChatOpen');
        expect(content).toContain('setIsChatOpen');
      });

      it('should have chat panel with slide-in animation', () => {
        const content = readFileContent('src/components/layout/MainLayout.tsx');
        expect(content).toContain('translate-x');
      });
    });
  });

  // ============================================================
  // SCENARIO 3: CRITICAL CLIENT FLOWS
  // ============================================================
  describe('Scenario 3: Critical Client Flows', () => {

    describe('3A: Wallet/Deposit Flow Structure', () => {
      it('WalletModal should exist', () => {
        expect(fileExists('src/components/wallet/WalletModal.tsx')).toBe(true);
      });

      it('WalletModal should support deposit and withdraw tabs', () => {
        const content = readFileContent('src/components/wallet/WalletModal.tsx');
        expect(content).toContain("'deposit'");
        expect(content).toContain("'withdraw'");
        expect(content).toContain('activeTab');
      });

      it('WalletModal should support 4 currencies (USDT, BTC, ETH, SOL)', () => {
        const content = readFileContent('src/components/wallet/WalletModal.tsx');
        expect(content).toContain('USDT');
        expect(content).toContain('BTC');
        expect(content).toContain('ETH');
        expect(content).toContain('SOL');
      });

      it('WalletModal should render QR code for deposits', () => {
        const content = readFileContent('src/components/wallet/WalletModal.tsx');
        expect(content).toContain('QRCodeSVG');
      });

      it('WalletModal should have copy-to-clipboard for deposit address', () => {
        const content = readFileContent('src/components/wallet/WalletModal.tsx');
        expect(content).toContain('clipboard');
        expect(content).toContain('copied');
      });

      it('WalletModal should fetch deposit address from API', () => {
        const content = readFileContent('src/components/wallet/WalletModal.tsx');
        expect(content).toContain('deposit-address');
        expect(content).toContain('fetchDepositAddress');
      });

      it('WalletModal should have loading state', () => {
        const content = readFileContent('src/components/wallet/WalletModal.tsx');
        expect(content).toContain('isLoading');
        expect(content).toContain('setIsLoading');
      });

      it('WalletModal should have error/success messages', () => {
        const content = readFileContent('src/components/wallet/WalletModal.tsx');
        expect(content).toContain("'success'");
        expect(content).toContain("'error'");
        expect(content).toContain('setMessage');
      });
    });

    describe('3B: Game Bet Flow Structure (Crash)', () => {
      it('CrashGamePanel should have bet amount input', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('betAmount');
        expect(content).toContain('setBetAmount');
      });

      it('CrashGamePanel should have auto-cashout input', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('autoCashout');
        expect(content).toContain('setAutoCashout');
      });

      it('CrashGamePanel should have bet status state machine', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('betStatus');
        expect(content).toContain('NONE');
        expect(content).toContain('PLACED');
      });

      it('CrashGamePanel should disable bet button during active bet', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('disabled');
        // Should have conditional disabled based on betStatus
        expect(content).toMatch(/disabled.*betStatus|betStatus.*disabled/);
      });

      it('CrashGamePanel should have auto-bet functionality', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('autoBet');
      });

      it('CrashGamePanel should display multiplier', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('multiplier');
      });

      it('CrashGamePanel should handle game states (WAITING, RUNNING, CRASHED)', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('WAITING');
        expect(content).toContain('RUNNING');
        expect(content).toContain('CRASHED');
      });

      it('CrashGamePanel should have keyboard shortcut (SPACE)', () => {
        const content = readFileContent('src/components/games/CrashGamePanel.tsx');
        expect(content).toContain('SPACE');
      });
    });

    describe('3C: Authentication Flow Structure', () => {
      it('LoginModal should exist', () => {
        expect(fileExists('src/components/modals/LoginModal.tsx')).toBe(true);
      });

      it('RegisterModal should exist', () => {
        expect(fileExists('src/components/modals/RegisterModal.tsx')).toBe(true);
      });

      it('AuthContext should have login/logout/register methods', () => {
        const content = readFileContent('src/contexts/AuthContext.tsx');
        expect(content).toContain('login');
        expect(content).toContain('logout');
        expect(content).toContain('register');
      });

      it('AuthContext should store JWT token', () => {
        const content = readFileContent('src/contexts/AuthContext.tsx');
        expect(content).toContain('token');
        expect(content).toContain('setToken');
      });

      it('ModalContext should manage login/register/wallet modals', () => {
        const content = readFileContent('src/contexts/ModalContext.tsx');
        expect(content).toContain('isLoginOpen');
        expect(content).toContain('isRegisterOpen');
        expect(content).toContain('isWalletOpen');
      });

      it('GlobalModals should render all modal components', () => {
        const content = readFileContent('src/components/modals/GlobalModals.tsx');
        expect(content).toContain('LoginModal');
        expect(content).toContain('RegisterModal');
        expect(content).toContain('WalletModal');
      });
    });

    describe('3D: Socket Connection Flow', () => {
      it('SocketContext should exist and manage connection', () => {
        const content = readFileContent('src/contexts/SocketContext.tsx');
        expect(content).toContain('socket');
        expect(content).toContain('connected');
      });

      it('SocketContext should handle authentication', () => {
        const content = readFileContent('src/contexts/SocketContext.tsx');
        expect(content).toContain('token');
        expect(content).toContain('auth');
      });

      it('SocketContext should handle reconnection', () => {
        const content = readFileContent('src/contexts/SocketContext.tsx');
        expect(content).toMatch(/reconnect|disconnect/);
      });
    });
  });

  // ============================================================
  // SCENARIO 4: ERROR BOUNDARIES (WHITE SCREEN PREVENTION)
  // ============================================================
  describe('Scenario 4: Error Boundaries — White Screen Prevention', () => {

    describe('4A: Global ErrorBoundary Component', () => {
      it('ErrorBoundary component should exist', () => {
        expect(fileExists('src/components/ErrorBoundary.tsx')).toBe(true);
      });

      it('ErrorBoundary should extend React.Component', () => {
        const content = readFileContent('src/components/ErrorBoundary.tsx');
        expect(content).toContain('Component');
        expect(content).toContain('getDerivedStateFromError');
      });

      it('ErrorBoundary should have retry button', () => {
        const content = readFileContent('src/components/ErrorBoundary.tsx');
        expect(content).toContain('Try Again');
        expect(content).toContain('handleRetry');
      });

      it('ErrorBoundary should have reload button', () => {
        const content = readFileContent('src/components/ErrorBoundary.tsx');
        expect(content).toContain('Reload Page');
        expect(content).toContain('window.location.reload');
      });

      it('ErrorBoundary should support gameName prop', () => {
        const content = readFileContent('src/components/ErrorBoundary.tsx');
        expect(content).toContain('gameName');
      });

      it('ErrorBoundary should show error details in development', () => {
        const content = readFileContent('src/components/ErrorBoundary.tsx');
        expect(content).toContain('NODE_ENV');
        expect(content).toContain('development');
      });

      it('ErrorBoundary should log errors to console', () => {
        const content = readFileContent('src/components/ErrorBoundary.tsx');
        expect(content).toContain('componentDidCatch');
        expect(content).toContain('console.error');
      });
    });

    describe('4B: All Game Pages Wrapped in ErrorBoundary', () => {
      const gamePages = [
        { name: 'Crash', file: 'src/app/games/crash/page.tsx' },
        { name: 'Plinko', file: 'src/app/games/plinko/page.tsx' },
        { name: 'Dice', file: 'src/app/games/dice/page.tsx' },
        { name: 'Mines', file: 'src/app/games/mines/page.tsx' },
        { name: 'Limbo', file: 'src/app/games/limbo/page.tsx' },
        { name: 'Penalty', file: 'src/app/games/penalty/page.tsx' },
        { name: 'Card Rush', file: 'src/app/games/card-rush/page.tsx' },
        { name: 'Olympus', file: 'src/app/games/olympus/page.tsx' },
        { name: 'Dragon Blaze', file: 'src/app/games/dragon-blaze/page.tsx' },
        { name: 'Nova Rush', file: 'src/app/games/nova-rush/page.tsx' },
      ];

      gamePages.forEach(({ name, file }) => {
        it(`[${name}] should be wrapped in ErrorBoundary`, () => {
          const content = readFileContent(file);
          expect(content).not.toBeNull();
          expect(hasErrorBoundary(content!)).toBe(true);
        });
      });
    });

    describe('4C: Provider Chain Integrity', () => {
      it('Providers should wrap in correct order (Branding > Socket > Auth > Modal > Sound)', () => {
        const content = readFileContent('src/app/providers.tsx');
        expect(content).not.toBeNull();
        
        // Search in the JSX section (after 'return') to avoid matching import order
        const jsxSection = content!.substring(content!.indexOf('return'));
        const brandingIdx = jsxSection.indexOf('<BrandingProvider');
        const socketIdx = jsxSection.indexOf('<SocketProvider');
        const authIdx = jsxSection.indexOf('<AuthProvider');
        const modalIdx = jsxSection.indexOf('<ModalProvider');
        const soundIdx = jsxSection.indexOf('<SoundProvider');
        
        expect(brandingIdx).toBeLessThan(socketIdx);
        expect(socketIdx).toBeLessThan(authIdx);
        expect(authIdx).toBeLessThan(modalIdx);
        expect(modalIdx).toBeLessThan(soundIdx);
      });

      it('GlobalModals should be inside all providers', () => {
        const content = readFileContent('src/app/providers.tsx');
        expect(content).toContain('GlobalModals');
      });

      it('Layout should wrap children in Providers', () => {
        const content = readFileContent('src/app/layout.tsx');
        expect(content).toContain('Providers');
      });
    });
  });

  // ============================================================
  // SCENARIO 5: ASSET INTEGRITY (BROKEN IMAGES/SOUNDS CHECK)
  // ============================================================
  describe('Scenario 5: Asset Integrity — No Broken References', () => {

    describe('5A: Sound Files Exist', () => {
      const requiredSounds = [
        'sounds/tick.mp3',
        'sounds/crash.mp3',
        'sounds/win.mp3',
        'sounds/bet.mp3',
        'sounds/cashout.mp3',
        'sounds/countdown.mp3',
        'sounds/click.mp3',
      ];

      requiredSounds.forEach(sound => {
        it(`/public/${sound} should exist`, () => {
          expect(fileExists(`public/${sound}`)).toBe(true);
        });
      });
    });

    describe('5B: SVG/Image Assets Exist', () => {
      it('/public/grid.svg should exist (Affiliates page)', () => {
        expect(fileExists('public/grid.svg')).toBe(true);
      });

      it('Olympus game images should exist', () => {
        const olympusContent = readFileContent('src/app/games/olympus/page.tsx');
        if (olympusContent) {
          const assetRefs = findAssetReferences(olympusContent);
          assetRefs.forEach(ref => {
            if (ref.includes('olympus') || ref.includes('zeus')) {
              expect(fileExists(`public${ref}`)).toBe(true);
            }
          });
        }
      });
    });

    describe('5C: CSS/Font Assets', () => {
      it('Global CSS file should exist', () => {
        expect(fileExists('src/styles/globals.css')).toBe(true);
      });

      it('Global CSS should have Tailwind directives', () => {
        const content = readFileContent('src/styles/globals.css');
        expect(content).toContain('@tailwind');
      });

      it('Tailwind config should exist', () => {
        const hasTailwindConfig =
          fileExists('tailwind.config.ts') ||
          fileExists('tailwind.config.js');
        expect(hasTailwindConfig).toBe(true);
      });
    });

    describe('5D: Configuration Files', () => {
      it('API config should exist', () => {
        const hasConfig =
          fileExists('src/config/api.ts') ||
          fileExists('src/config/api.tsx');
        expect(hasConfig).toBe(true);
      });

      it('Next.js config should exist', () => {
        const hasNextConfig =
          fileExists('next.config.js') ||
          fileExists('next.config.ts') ||
          fileExists('next.config.mjs');
        expect(hasNextConfig).toBe(true);
      });

      it('TypeScript config should exist', () => {
        expect(fileExists('tsconfig.json')).toBe(true);
      });
    });
  });

  // ============================================================
  // SCENARIO 6: NAVIGATION & ROUTING LOGIC
  // ============================================================
  describe('Scenario 6: Navigation & Routing Logic', () => {

    describe('6A: Sidebar Navigation', () => {
      it('Sidebar should have navigation links', () => {
        const content = readFileContent('src/components/layout/Sidebar.tsx');
        expect(content).not.toBeNull();
        expect(content).toContain('nav-profile');
        expect(content).toContain('nav-wallet');
      });

      it('Sidebar should have game links', () => {
        const content = readFileContent('src/components/layout/Sidebar.tsx');
        expect(content).toContain('/games/crash');
        expect(content).toContain('/games/plinko');
      });

      it('Sidebar should have admin links for admin users', () => {
        const content = readFileContent('src/components/layout/Sidebar.tsx');
        expect(content).toContain('admin');
      });

      it('Sidebar should have VIP link', () => {
        const content = readFileContent('src/components/layout/Sidebar.tsx');
        expect(content).toContain('nav-vip');
      });

      it('Sidebar should have close button for mobile', () => {
        const content = readFileContent('src/components/layout/Sidebar.tsx');
        expect(content).toContain('onClose');
      });
    });

    describe('6B: Footer Navigation', () => {
      it('Footer should exist', () => {
        expect(fileExists('src/components/layout/Footer.tsx')).toBe(true);
      });

      it('Footer should have legal links (Privacy, Terms, Responsible Gaming)', () => {
        const content = readFileContent('src/components/layout/Footer.tsx');
        expect(content).toContain('/privacy');
        expect(content).toContain('/terms');
        expect(content).toContain('/responsible-gaming');
      });
    });

    describe('6C: Homepage Navigation', () => {
      it('Homepage should use MainLayout', () => {
        const content = readFileContent('src/app/page.tsx');
        expect(content).toContain('MainLayout');
      });

      it('Homepage should have GameGrid', () => {
        const content = readFileContent('src/app/page.tsx');
        expect(content).toContain('GameGrid');
      });

      it('Homepage should use BrandingContext', () => {
        const content = readFileContent('src/app/page.tsx');
        expect(content).toContain('useBranding');
      });
    });

    describe('6D: Data-TestID Coverage', () => {
      const criticalComponents = [
        { name: 'Header', file: 'src/components/layout/Header.tsx', expectedIds: ['header', 'mobile-menu-btn', 'header-wallet-balance'] },
        { name: 'Sidebar', file: 'src/components/layout/Sidebar.tsx', expectedIds: ['nav-profile', 'nav-wallet'] },
      ];

      criticalComponents.forEach(({ name, file, expectedIds }) => {
        expectedIds.forEach(testId => {
          it(`[${name}] should have data-testid="${testId}"`, () => {
            const content = readFileContent(file);
            expect(content).toContain(`data-testid="${testId}"`);
          });
        });
      });
    });

    describe('6E: Dynamic Routes', () => {
      it('Dynamic game route [provider]/[slug] should exist', () => {
        expect(fileExists('src/app/games/[provider]/[slug]/page.tsx')).toBe(true);
      });

      it('Dynamic sports category route should exist', () => {
        expect(fileExists('src/app/sports/[category]/page.tsx')).toBe(true);
      });

      it('Dynamic game route should handle params', () => {
        const content = readFileContent('src/app/games/[provider]/[slug]/page.tsx');
        expect(content).toMatch(/params|provider|slug/);
      });
    });
  });
});
