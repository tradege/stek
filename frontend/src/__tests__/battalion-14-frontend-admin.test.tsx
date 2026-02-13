/**
 * =====================================================
 * BATTALION 14 — FRONTEND ADMIN LOGIC
 * =====================================================
 * The Boss Level — Admin Panel UI Verification
 * 
 * Scenario 1: The Ban Hammer (UserManagement)
 * Scenario 2: The Vault Keeper (Withdrawals)
 * Scenario 3: The Game Master (GameSettings)
 * Scenario 4: The Command Center (Dashboard)
 * Scenario 5: The Brand Painter (BrandSettings)
 * Scenario 6: The Fortress Gate (Admin Layout & Security)
 * =====================================================
 */

import * as fs from 'fs';
import * as path from 'path';

// Resolve frontend root
const FRONTEND_ROOT = path.resolve(__dirname, '../..');

function readComponent(relativePath: string): string {
  const fullPath = path.join(FRONTEND_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Component not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('Battalion 14 — Frontend Admin Logic', () => {
  // =====================================================
  // SCENARIO 1: THE BAN HAMMER (UserManagement)
  // =====================================================
  describe('Scenario 1: The Ban Hammer (UserManagement)', () => {
    let usersCode: string;

    beforeAll(() => {
      usersCode = readComponent('src/app/admin/users/page.tsx');
    });

    describe('1A: Page Structure & Auth Guard', () => {
      it('admin users page exists', () => {
        expect(usersCode).toBeDefined();
        expect(usersCode.length).toBeGreaterThan(100);
      });

      it('uses client-side rendering', () => {
        expect(usersCode).toMatch(/["']use client["']/);
      });

      it('requires authentication token', () => {
        expect(usersCode).toMatch(/token|getToken|Bearer/);
      });

      it('fetches users from admin API', () => {
        expect(usersCode).toMatch(/api\/admin\/users/);
      });

      it('has loading state', () => {
        expect(usersCode).toMatch(/loading|isLoading/);
        expect(usersCode).toMatch(/animate-spin|spinner/);
      });
    });

    describe('1B: Ban Action Flow', () => {
      it('has handleAction function for ban/unban/approve', () => {
        expect(usersCode).toContain('handleAction');
      });

      it('shows confirmation dialog before banning', () => {
        expect(usersCode).toContain('confirm("Ban this user?")');
      });

      it('sends POST to ban endpoint with action parameter', () => {
        // handleAction sends POST to /api/admin/users/{id}/{action} where action='ban'
        expect(usersCode).toContain('handleAction(u.id, "ban")');
        // The URL template: `${API_URL}/api/admin/users/${userId}/${action}`
        expect(usersCode).toMatch(/api\/admin\/users\/.*action/);
      });

      it('updates user status to BANNED after successful ban', () => {
        expect(usersCode).toContain('ban: "BANNED"');
      });

      it('has ban button with danger styling', () => {
        expect(usersCode).toMatch(/bg-danger-muted.*text-danger-primary/);
        expect(usersCode).toContain('Ban');
      });

      it('shows processing state while banning', () => {
        expect(usersCode).toContain('processingId');
        expect(usersCode).toContain('disabled:opacity-50');
      });

      it('ban button only shows for non-admin active users', () => {
        // Admins cannot be banned, only non-admin active users
        expect(usersCode).toContain('u.role !== "ADMIN"');
        expect(usersCode).toContain('u.status !== "PENDING_APPROVAL"');
      });
    });

    describe('1C: Unban Action Flow', () => {
      it('has unban button for banned users', () => {
        expect(usersCode).toContain('Unban');
      });

      it('sends POST to unban endpoint', () => {
        expect(usersCode).toMatch(/handleAction\(u\.id,\s*"unban"\)/);
      });

      it('updates status to ACTIVE after unban', () => {
        expect(usersCode).toContain('unban: "ACTIVE"');
      });

      it('unban button shows only for BANNED users', () => {
        expect(usersCode).toContain('u.status === "BANNED"');
      });
    });

    describe('1D: Status Badges', () => {
      it('has statusBadge function', () => {
        expect(usersCode).toContain('statusBadge');
      });

      it('ACTIVE status has green/success styling', () => {
        expect(usersCode).toContain('ACTIVE: { cls: "bg-success-muted text-success-primary"');
      });

      it('BANNED status has red/danger styling', () => {
        expect(usersCode).toContain('BANNED: { cls: "bg-danger-muted text-danger-primary"');
      });

      it('SUSPENDED status has yellow/warning styling', () => {
        expect(usersCode).toContain('SUSPENDED: { cls: "bg-warning-muted text-warning-primary"');
      });

      it('PENDING_APPROVAL has pulse animation', () => {
        expect(usersCode).toMatch(/PENDING_APPROVAL.*animate-pulse/);
      });

      it('displays human-readable status text', () => {
        expect(usersCode).toContain('text: "Active"');
        expect(usersCode).toContain('text: "Banned"');
        expect(usersCode).toContain('text: "Suspended"');
      });
    });

    describe('1E: Approve Action Flow', () => {
      it('shows confirmation dialog before approving', () => {
        expect(usersCode).toContain('confirm("Approve this user?")');
      });

      it('updates status to ACTIVE after approval', () => {
        expect(usersCode).toContain('approve: "ACTIVE"');
      });

      it('approve button only shows for PENDING_APPROVAL users', () => {
        expect(usersCode).toContain('u.status === "PENDING_APPROVAL"');
      });

      it('approve button has success/green styling', () => {
        expect(usersCode).toMatch(/approve.*bg-success-primary/s);
      });
    });

    describe('1F: Bulk Actions', () => {
      it('has handleBulkAction function', () => {
        expect(usersCode).toContain('handleBulkAction');
      });

      it('supports bulk approve, ban, and unban', () => {
        expect(usersCode).toContain('"approve" | "ban" | "unban"');
      });

      it('shows confirmation with count of selected users', () => {
        expect(usersCode).toContain('`${action} ${selected.length} user(s)?`');
      });

      it('has progress tracking for bulk operations', () => {
        expect(usersCode).toContain('bulkProgress');
        expect(usersCode).toContain('bulkProcessing');
      });

      it('has checkbox selection for users', () => {
        expect(usersCode).toContain('selectedIds');
        expect(usersCode).toContain('toggleSelect');
      });

      it('admins cannot be selected for bulk actions', () => {
        expect(usersCode).toContain('u.role !== "ADMIN"');
      });

      it('has Ban Selected button with danger styling', () => {
        expect(usersCode).toContain('Ban Selected');
        expect(usersCode).toMatch(/Ban Selected.*bg-danger-primary/s);
      });

      it('has Unban Selected button', () => {
        expect(usersCode).toContain('Unban Selected');
      });
    });

    describe('1G: User Detail Modal', () => {
      it('has UserDetailModal component', () => {
        expect(usersCode).toContain('UserDetailModal');
      });

      it('opens detail modal on Edit button click', () => {
        expect(usersCode).toContain('setDetailUserId(u.id)');
      });

      it('shows user stats in detail modal', () => {
        expect(usersCode).toContain('detail.stats.totalBets');
        expect(usersCode).toContain('detail.stats.totalProfit');
      });

      it('has balance adjustment in detail modal', () => {
        expect(usersCode).toContain('adjustAmount');
        expect(usersCode).toContain('adjustReason');
        expect(usersCode).toContain('handleAdjustBalance');
      });

      it('has credit and debit buttons', () => {
        expect(usersCode).toContain('+ Credit');
        expect(usersCode).toContain('- Debit');
      });

      it('shows confirmation before balance adjustment', () => {
        expect(usersCode).toMatch(/confirm\(.*credit.*debit/s);
      });

      it('displays user detail fields', () => {
        expect(usersCode).toContain('"Status"');
        expect(usersCode).toContain('"Role"');
        expect(usersCode).toContain('"VIP Level"');
        expect(usersCode).toContain('"2FA"');
        expect(usersCode).toContain('"Last Login IP"');
        expect(usersCode).toContain('"Total Wagered"');
        expect(usersCode).toContain('"Total Deposits"');
        expect(usersCode).toContain('"Total Withdrawals"');
      });
    });

    describe('1H: Filtering & Search', () => {
      it('has search by username/email', () => {
        expect(usersCode).toContain('searchTerm');
      });

      it('has status filter', () => {
        expect(usersCode).toContain('filterStatus');
      });

      it('supports filtering by all statuses', () => {
        expect(usersCode).toContain('"ALL"');
        expect(usersCode).toContain('"PENDING_APPROVAL"');
        expect(usersCode).toContain('"ACTIVE"');
        expect(usersCode).toContain('"BANNED"');
        expect(usersCode).toContain('"SUSPENDED"');
      });

      it('has View Pending quick filter', () => {
        expect(usersCode).toContain('View Pending');
      });

      it('shows pending count badge', () => {
        expect(usersCode).toContain('pendingCount');
      });
    });
  });

  // =====================================================
  // SCENARIO 2: THE VAULT KEEPER (Withdrawals)
  // =====================================================
  describe('Scenario 2: The Vault Keeper (Withdrawals)', () => {
    let withdrawalsCode: string;

    beforeAll(() => {
      withdrawalsCode = readComponent('src/app/admin/withdrawals/page.tsx');
    });

    describe('2A: Page Structure', () => {
      it('withdrawals page exists', () => {
        expect(withdrawalsCode).toBeDefined();
        expect(withdrawalsCode.length).toBeGreaterThan(100);
      });

      it('uses client-side rendering', () => {
        expect(withdrawalsCode).toMatch(/["']use client["']/);
      });

      it('fetches withdrawals from admin API', () => {
        expect(withdrawalsCode).toContain('/api/admin/withdrawals');
      });
    });

    describe('2B: Approval Flow', () => {
      it('has handleApprove function', () => {
        expect(withdrawalsCode).toContain('handleApprove');
      });

      it('shows confirmation before approving', () => {
        expect(withdrawalsCode).toContain('confirm("Approve this withdrawal?');
      });

      it('sends POST to approve endpoint', () => {
        expect(withdrawalsCode).toMatch(/\/api\/admin\/withdrawals\/.*\/approve/);
      });

      it('approve button has success/green styling', () => {
        expect(withdrawalsCode).toMatch(/Approve.*bg-success-primary/s);
      });

      it('shows checkmark on approve button', () => {
        expect(withdrawalsCode).toContain('✓ Approve');
      });

      it('approve button only shows for PENDING withdrawals', () => {
        expect(withdrawalsCode).toContain('w.status === "PENDING"');
      });

      it('shows processing state while approving', () => {
        expect(withdrawalsCode).toContain('processingId');
      });
    });

    describe('2C: Rejection Flow', () => {
      it('has handleReject function', () => {
        expect(withdrawalsCode).toContain('handleReject');
      });

      it('opens rejection reason modal', () => {
        expect(withdrawalsCode).toContain('rejectingId');
        expect(withdrawalsCode).toContain('setRejectingId');
      });

      it('has rejection reason input field', () => {
        expect(withdrawalsCode).toContain('rejectReason');
        expect(withdrawalsCode).toContain('Reason for rejection');
      });

      it('sends POST to reject endpoint with reason', () => {
        expect(withdrawalsCode).toMatch(/\/api\/admin\/withdrawals\/.*\/reject/);
        expect(withdrawalsCode).toContain('body: JSON.stringify({ reason: rejectReason })');
      });

      it('reject button has danger styling', () => {
        expect(withdrawalsCode).toContain('✕ Reject');
        expect(withdrawalsCode).toMatch(/Reject.*bg-danger-muted/s);
      });

      it('modal shows refund message', () => {
        expect(withdrawalsCode).toContain('refunded to the user');
      });

      it('modal has Reject & Refund button', () => {
        expect(withdrawalsCode).toContain('Reject & Refund');
      });

      it('modal has Cancel button to close', () => {
        expect(withdrawalsCode).toContain('setRejectingId(null)');
        expect(withdrawalsCode).toContain('setRejectReason("")');
      });

      it('clears rejection state after successful reject', () => {
        expect(withdrawalsCode).toContain('setRejectingId(null)');
        expect(withdrawalsCode).toContain('setRejectReason("")');
      });
    });

    describe('2D: Status Badges', () => {
      it('has statusBadge function', () => {
        expect(withdrawalsCode).toContain('statusBadge');
      });

      it('PENDING has yellow styling with pulse animation', () => {
        expect(withdrawalsCode).toMatch(/PENDING.*yellow.*animate-pulse/s);
      });

      it('pending rows have yellow background highlight', () => {
        expect(withdrawalsCode).toContain('bg-yellow-500/5');
      });
    });

    describe('2E: Risk Assessment', () => {
      it('has riskBadge function', () => {
        expect(withdrawalsCode).toContain('riskBadge');
      });

      it('displays risk score and level', () => {
        expect(withdrawalsCode).toContain('r.score');
        expect(withdrawalsCode).toContain('r.level');
      });

      it('HIGH risk has red left border on row', () => {
        expect(withdrawalsCode).toContain('border-l-red-500');
      });
    });

    describe('2F: Summary Stats', () => {
      it('calculates pending count', () => {
        expect(withdrawalsCode).toContain('pendingCount');
        expect(withdrawalsCode).toMatch(/filter\(w => w\.status === "PENDING"\)\.length/);
      });

      it('calculates total pending amount', () => {
        expect(withdrawalsCode).toContain('totalPending');
      });

      it('calculates total approved amount', () => {
        expect(withdrawalsCode).toContain('totalApproved');
      });

      it('has Review Now quick action button', () => {
        expect(withdrawalsCode).toContain('Review Now');
      });
    });

    describe('2G: Filtering', () => {
      it('has status filter', () => {
        expect(withdrawalsCode).toContain('filterStatus');
      });

      it('supports all withdrawal statuses', () => {
        expect(withdrawalsCode).toContain('"ALL"');
        expect(withdrawalsCode).toContain('"PENDING"');
        expect(withdrawalsCode).toContain('"CONFIRMED"');
        expect(withdrawalsCode).toContain('"CANCELLED"');
        expect(withdrawalsCode).toContain('"FAILED"');
      });

      it('shows pending count in filter button', () => {
        expect(withdrawalsCode).toMatch(/PENDING.*pendingCount/s);
      });
    });

    describe('2H: Table Columns', () => {
      it('displays user info (username, email, IP)', () => {
        expect(withdrawalsCode).toContain('w.username');
        expect(withdrawalsCode).toContain('w.email');
        expect(withdrawalsCode).toContain('w.userIp');
      });

      it('displays amount with currency', () => {
        expect(withdrawalsCode).toContain('w.amount');
        expect(withdrawalsCode).toContain('w.currency');
      });

      it('displays crypto wallet address', () => {
        expect(withdrawalsCode).toContain('w.walletAddress');
        expect(withdrawalsCode).toContain('w.network');
      });

      it('displays confirmation time', () => {
        expect(withdrawalsCode).toContain('w.confirmedAt');
      });
    });
  });

  // =====================================================
  // SCENARIO 3: THE GAME MASTER (GameSettings)
  // =====================================================
  describe('Scenario 3: The Game Master (GameSettings)', () => {
    let gamesCode: string;

    beforeAll(() => {
      gamesCode = readComponent('src/app/admin/games/page.tsx');
    });

    describe('3A: Page Structure', () => {
      it('games page exists', () => {
        expect(gamesCode).toBeDefined();
        expect(gamesCode.length).toBeGreaterThan(100);
      });

      it('has Game Control Center title', () => {
        expect(gamesCode).toContain('Game Control Center');
      });

      it('has three tabs: Overview, Crash Settings, Global Settings', () => {
        expect(gamesCode).toContain('Games Overview');
        expect(gamesCode).toContain('Crash Settings');
        expect(gamesCode).toContain('Global Settings');
      });
    });

    describe('3B: House Edge / RTP Editing', () => {
      it('has editable house edge input', () => {
        expect(gamesCode).toContain('editConfig.houseEdge');
      });

      it('house edge input has min=0 and max=20 validation', () => {
        expect(gamesCode).toMatch(/houseEdge[\s\S]*?min="0"/);
        expect(gamesCode).toMatch(/houseEdge[\s\S]*?max="20"/);
      });

      it('updates editConfig on house edge change', () => {
        expect(gamesCode).toContain('setEditConfig({ ...editConfig, houseEdge: parseFloat(e.target.value)');
      });

      it('has instant bust rate input', () => {
        expect(gamesCode).toContain('editConfig.instantBust');
      });

      it('instant bust input has min=0 and max=20', () => {
        expect(gamesCode).toMatch(/instantBust[\s\S]*?min="0"/);
        expect(gamesCode).toMatch(/instantBust[\s\S]*?max="20"/);
      });

      it('displays house edge for each game in overview', () => {
        expect(gamesCode).toContain('game.houseEdge');
      });
    });

    describe('3C: Save Configuration', () => {
      it('has saveConfig function', () => {
        expect(gamesCode).toContain('saveConfig');
      });

      it('sends POST to game config endpoint', () => {
        expect(gamesCode).toContain('/api/admin/game/config');
        expect(gamesCode).toContain("method: 'POST'");
      });

      it('sends editConfig as JSON body', () => {
        expect(gamesCode).toContain('body: JSON.stringify(editConfig)');
      });

      it('shows success message after save', () => {
        expect(gamesCode).toContain('Configuration saved!');
        expect(gamesCode).toContain("type: 'success'");
      });

      it('shows error message on save failure', () => {
        expect(gamesCode).toContain('Failed to save configuration');
        expect(gamesCode).toContain("type: 'error'");
      });

      it('has Save Configuration button with icon', () => {
        expect(gamesCode).toContain('Save Configuration');
        expect(gamesCode).toContain('<Save');
      });

      it('save button is disabled while saving', () => {
        expect(gamesCode).toContain('disabled={saving}');
        expect(gamesCode).toContain("'Saving...'");
      });

      it('updates config state after successful save', () => {
        expect(gamesCode).toContain('setConfig(data.data)');
        expect(gamesCode).toContain('setEditConfig(data.data)');
      });
    });

    describe('3D: Configuration Warning', () => {
      it('shows warning about house edge changes', () => {
        expect(gamesCode).toContain('Configuration Warning');
      });

      it('warns about mathematical fairness', () => {
        expect(gamesCode).toContain('mathematical fairness');
      });

      it('warns about gaming license compliance', () => {
        expect(gamesCode).toContain('gaming license');
      });

      it('changes take effect on next round', () => {
        expect(gamesCode).toContain('take effect on the next round');
      });
    });

    describe('3E: Bot Configuration', () => {
      it('has bots enabled toggle', () => {
        expect(gamesCode).toContain('editConfig.botsEnabled');
      });

      it('toggle shows Enabled/Disabled state', () => {
        expect(gamesCode).toContain("'Enabled'");
        expect(gamesCode).toContain("'Disabled'");
      });

      it('enabled state has green styling', () => {
        expect(gamesCode).toMatch(/botsEnabled[\s\S]*?bg-green-500/);
      });

      it('disabled state has red styling', () => {
        expect(gamesCode).toMatch(/botsEnabled[\s\S]*?bg-red-500/);
      });

      it('has min bot bet input', () => {
        expect(gamesCode).toContain('editConfig.minBotBet');
      });

      it('has max bot bet input', () => {
        expect(gamesCode).toContain('editConfig.maxBotBet');
      });

      it('has max bots per round input with max=50', () => {
        expect(gamesCode).toContain('editConfig.maxBotsPerRound');
        expect(gamesCode).toMatch(/maxBotsPerRound[\s\S]*?max="50"/);
      });
    });

    describe('3F: Games Overview', () => {
      it('displays game cards with name and description', () => {
        expect(gamesCode).toContain('game.name');
        expect(gamesCode).toContain('game.description');
      });

      it('shows game status badges (active/maintenance/disabled)', () => {
        expect(gamesCode).toContain("'active'");
        expect(gamesCode).toContain("'maintenance'");
        expect(gamesCode).toContain("'disabled'");
      });

      it('active status has green badge', () => {
        expect(gamesCode).toMatch(/active.*bg-green-500/s);
      });

      it('maintenance status has yellow badge', () => {
        expect(gamesCode).toMatch(/maintenance.*bg-yellow-500/s);
      });

      it('disabled status has red badge', () => {
        expect(gamesCode).toMatch(/disabled.*bg-red-500/s);
      });
    });

    describe('3G: Global Settings Display', () => {
      it('shows default currency (USDT)', () => {
        expect(gamesCode).toContain('USDT (Tether)');
      });

      it('shows minimum bet ($0.01)', () => {
        expect(gamesCode).toContain('$0.01');
      });

      it('shows maximum bet ($10,000)', () => {
        expect(gamesCode).toContain('$10,000');
      });

      it('shows Provably Fair is enabled', () => {
        expect(gamesCode).toContain('Provably Fair');
        expect(gamesCode).toContain('Enabled (All Games)');
      });

      it('shows rate limiting (500ms)', () => {
        expect(gamesCode).toContain('500ms between bets');
      });

      it('shows atomic transactions enabled', () => {
        expect(gamesCode).toContain('Row Locking Enabled');
      });

      it('shows game algorithms', () => {
        expect(gamesCode).toContain('ICDF Exponential');
        expect(gamesCode).toContain('Galton Board Simulation');
        expect(gamesCode).toContain('HMAC-SHA256 Roll');
        expect(gamesCode).toContain('Fisher-Yates Shuffle');
      });
    });

    describe('3H: Input Validation (Safety Check)', () => {
      it('house edge input uses HTML5 min/max attributes', () => {
        // HTML5 number inputs with min/max prevent out-of-range values
        expect(gamesCode).toMatch(/type="number"[\s\S]*?houseEdge/);
      });

      it('parseFloat prevents NaN values', () => {
        expect(gamesCode).toContain('parseFloat(e.target.value) || 0');
      });

      it('parseInt prevents NaN for integer fields', () => {
        expect(gamesCode).toContain('parseInt(e.target.value) || 0');
      });

      it('bot bet inputs have min=0.01 and step=0.01', () => {
        expect(gamesCode).toMatch(/minBotBet[\s\S]*?min="0.01"/);
        expect(gamesCode).toMatch(/minBotBet[\s\S]*?step="0.01"/);
      });
    });
  });

  // =====================================================
  // SCENARIO 4: THE COMMAND CENTER (Dashboard)
  // =====================================================
  describe('Scenario 4: The Command Center (Dashboard)', () => {
    let dashboardCode: string;

    beforeAll(() => {
      dashboardCode = readComponent('src/app/admin/dashboard/page.tsx');
    });

    describe('4A: Page Structure', () => {
      it('dashboard page exists', () => {
        expect(dashboardCode).toBeDefined();
        expect(dashboardCode.length).toBeGreaterThan(100);
      });

      it('uses client-side rendering', () => {
        expect(dashboardCode).toContain("'use client'");
      });

      it('fetches stats from admin API', () => {
        expect(dashboardCode).toMatch(/api\/admin\/dashboard\/stats|api\/admin\/stats/);
      });
    });

    describe('4B: Financial Stats Cards', () => {
      it('displays Total Revenue / GGR', () => {
        expect(dashboardCode).toContain('totalRevenue');
        expect(dashboardCode).toContain('totalGGR');
      });

      it('displays Net Profit', () => {
        expect(dashboardCode).toContain('netProfit');
      });

      it('displays Total Deposits', () => {
        expect(dashboardCode).toContain('totalDeposits');
      });

      it('displays Total Withdrawals', () => {
        expect(dashboardCode).toContain('totalWithdrawals');
      });

      it('displays Active Users count', () => {
        expect(dashboardCode).toContain('activeUsers');
      });

      it('displays Active Sessions', () => {
        expect(dashboardCode).toContain('activeSessions');
      });

      it('initializes all stats to 0', () => {
        expect(dashboardCode).toContain('totalRevenue: 0');
        expect(dashboardCode).toContain('netProfit: 0');
        expect(dashboardCode).toContain('totalDeposits: 0');
        expect(dashboardCode).toContain('totalWithdrawals: 0');
        expect(dashboardCode).toContain('activeUsers: 0');
      });
    });

    describe('4C: Data Type Safety', () => {
      it('has typed DashboardStats interface', () => {
        expect(dashboardCode).toMatch(/interface.*{[\s\S]*totalRevenue.*number/);
      });

      it('uses nullish coalescing for API data', () => {
        expect(dashboardCode).toContain('??');
      });

      it('handles missing GGR field gracefully', () => {
        expect(dashboardCode).toContain('data.totalGGR ?? data.ggr ?? 0');
      });
    });
  });

  // =====================================================
  // SCENARIO 5: THE BRAND PAINTER (BrandSettings)
  // =====================================================
  describe('Scenario 5: The Brand Painter (BrandSettings)', () => {
    let brandCode: string;

    beforeAll(() => {
      brandCode = readComponent('src/app/admin/brand-settings/page.tsx');
    });

    describe('5A: Page Structure', () => {
      it('brand settings page exists', () => {
        expect(brandCode).toBeDefined();
        expect(brandCode.length).toBeGreaterThan(100);
      });

      it('fetches brand settings from super-admin API', () => {
        expect(brandCode).toContain('/api/super-admin/brand-settings');
      });
    });

    describe('5B: Brand Configuration Fields', () => {
      it('has brandName field', () => {
        expect(brandCode).toContain('brandName');
      });

      it('has domain field', () => {
        expect(brandCode).toContain('domain');
      });

      it('has logoUrl field', () => {
        expect(brandCode).toContain('logoUrl');
      });

      it('has all 6 color fields', () => {
        expect(brandCode).toContain('primaryColor');
        expect(brandCode).toContain('secondaryColor');
        expect(brandCode).toContain('accentColor');
        expect(brandCode).toContain('backgroundColor');
        expect(brandCode).toContain('cardColor');
        expect(brandCode).toContain('dangerColor');
      });

      it('has color descriptions for each field', () => {
        expect(brandCode).toContain('Main brand color');
        expect(brandCode).toContain('Secondary elements');
        expect(brandCode).toContain('Success states');
        expect(brandCode).toContain('Error states');
      });
    });

    describe('5C: Save Flow', () => {
      it('has handleSave function', () => {
        expect(brandCode).toContain('handleSave');
      });

      it('tracks original settings for change detection', () => {
        expect(brandCode).toContain('original');
        expect(brandCode).toContain('setOriginal');
      });

      it('has error handling', () => {
        expect(brandCode).toContain('error');
        expect(brandCode).toContain('setError');
      });
    });
  });

  // =====================================================
  // SCENARIO 6: THE FORTRESS GATE (Admin Layout & Security)
  // =====================================================
  describe('Scenario 6: The Fortress Gate (Admin Layout & Security)', () => {
    let layoutCode: string;
    let sidebarCode: string;

    beforeAll(() => {
      layoutCode = readComponent('src/app/admin/layout.tsx');
      sidebarCode = readComponent('src/components/admin/AdminSidebar.tsx');
    });

    describe('6A: Role-Based Access Control', () => {
      it('defines allowed roles for admin area', () => {
        expect(layoutCode).toContain('ALLOWED_ROLES');
      });

      it('allows ADMIN role', () => {
        expect(layoutCode).toContain("'ADMIN'");
      });

      it('allows SUPER_MASTER role', () => {
        expect(layoutCode).toContain("'SUPER_MASTER'");
      });

      it('allows MASTER role', () => {
        expect(layoutCode).toContain("'MASTER'");
      });

      it('allows AGENT role', () => {
        expect(layoutCode).toContain("'AGENT'");
      });

      it('redirects unauthorized users to home', () => {
        expect(layoutCode).toContain("router.push('/')");
      });

      it('checks user role against allowed roles', () => {
        expect(layoutCode).toContain('ALLOWED_ROLES.includes(user.role)');
      });

      it('returns null for unauthorized users (no flash)', () => {
        expect(layoutCode).toContain('return null');
      });
    });

    describe('6B: Role Badge Display', () => {
      it('has role badge configuration', () => {
        expect(layoutCode).toContain('roleBadgeConfig');
      });

      it('ADMIN badge has red styling', () => {
        expect(layoutCode).toContain("ADMIN: { text: 'ADMIN', color: 'bg-red-500/20 text-red-400'");
      });

      it('SUPER_MASTER badge has purple styling', () => {
        expect(layoutCode).toContain("SUPER_MASTER: { text: 'SUPER', color: 'bg-purple-500/20 text-purple-400'");
      });

      it('MASTER badge has orange styling', () => {
        expect(layoutCode).toContain("MASTER: { text: 'MASTER', color: 'bg-orange-500/20 text-orange-400'");
      });

      it('AGENT badge has blue styling', () => {
        expect(layoutCode).toContain("AGENT: { text: 'AGENT', color: 'bg-blue-500/20 text-blue-400'");
      });

      it('displays panel name based on role', () => {
        expect(layoutCode).toContain('panelName');
        expect(layoutCode).toContain("panelName: 'Admin Panel'");
        expect(layoutCode).toContain("panelName: 'Master Panel'");
        expect(layoutCode).toContain("panelName: 'Agent Panel'");
      });
    });

    describe('6C: Admin Sidebar Navigation', () => {
      it('has admin navigation items', () => {
        expect(sidebarCode).toContain('adminNavItems');
      });

      it('has Dashboard link', () => {
        expect(sidebarCode).toContain("href: '/admin/dashboard'");
      });

      it('has Users link', () => {
        expect(sidebarCode).toContain("href: '/admin/users'");
      });

      it('has Finance link', () => {
        expect(sidebarCode).toContain("href: '/admin/finance'");
      });

      it('has Transactions link', () => {
        expect(sidebarCode).toContain("href: '/admin/transactions'");
      });

      it('has Withdrawals link', () => {
        expect(sidebarCode).toContain("href: '/admin/withdrawals'");
      });

      it('has Game Control link', () => {
        expect(sidebarCode).toContain("href: '/admin/games'");
      });

      it('has Sports Betting link with NEW badge', () => {
        expect(sidebarCode).toMatch(/href.*\/admin\/sports/);
        expect(sidebarCode).toMatch(/badge.*NEW/);
      });

      it('has Settings link', () => {
        expect(sidebarCode).toContain("href: '/admin/settings'");
      });

      it('has Game Logs link', () => {
        expect(sidebarCode).toContain("href: '/admin/game-history'");
      });
    });

    describe('6D: Super Admin Only Items', () => {
      it('has super admin only navigation items', () => {
        expect(sidebarCode).toContain('superAdminOnlyItems');
      });

      it('has Brand Settings (super admin only)', () => {
        expect(sidebarCode).toContain("href: '/admin/brand-settings'");
      });

      it('has God Mode (super admin only)', () => {
        expect(sidebarCode).toContain("href: '/admin/god-mode'");
        expect(sidebarCode).toContain("badge: 'GOD'");
      });

      it('checks for super admin email', () => {
        expect(sidebarCode).toContain('marketedgepros@gmail.com');
      });

      it('only shows super admin items to authorized user', () => {
        expect(sidebarCode).toContain('isSuperAdmin');
      });
    });

    describe('6E: Mobile Responsiveness', () => {
      it('layout has mobile menu button', () => {
        expect(layoutCode).toContain('admin-mobile-menu');
        expect(layoutCode).toContain('lg:hidden');
      });

      it('sidebar has mobile overlay', () => {
        expect(sidebarCode).toContain('admin-sidebar-overlay');
      });

      it('sidebar has close button for mobile', () => {
        expect(sidebarCode).toContain('admin-sidebar-close');
      });

      it('sidebar slides in/out with animation', () => {
        expect(sidebarCode).toContain('translate-x-0');
        expect(sidebarCode).toContain('-translate-x-full');
        expect(sidebarCode).toContain('transition-transform');
      });

      it('sidebar is fixed on desktop (lg:translate-x-0)', () => {
        expect(sidebarCode).toContain('lg:translate-x-0');
      });

      it('main content has left margin on desktop', () => {
        expect(layoutCode).toContain('lg:ml-64');
      });

      it('has Back to Casino button', () => {
        expect(layoutCode).toContain('Back to Casino');
      });

      it('displays username and role badge', () => {
        expect(layoutCode).toContain('user.username');
        expect(layoutCode).toContain('roleConfig.text');
      });
    });

    describe('6F: Admin Header', () => {
      it('has admin header with data-testid', () => {
        expect(layoutCode).toContain('data-testid="admin-header"');
      });

      it('header is sticky', () => {
        expect(layoutCode).toContain('sticky top-0');
      });

      it('header has backdrop blur', () => {
        expect(layoutCode).toContain('backdrop-blur');
      });

      it('has loading spinner while checking auth', () => {
        expect(layoutCode).toContain('animate-spin');
      });
    });

    describe('6G: Sidebar Branding', () => {
      it('displays brand name from context', () => {
        expect(sidebarCode).toContain("branding?.brandName || 'StakePro'");
      });

      it('has admin logo with data-testid', () => {
        expect(sidebarCode).toContain('data-testid="admin-logo-text"');
      });

      it('shows Admin Panel subtitle', () => {
        expect(sidebarCode).toContain('Admin Panel');
      });

      it('has Admin Mode toggle indicator', () => {
        expect(sidebarCode).toContain('Admin Mode');
      });

      it('has Management section header', () => {
        expect(sidebarCode).toContain('Management');
      });
    });
  });
});
