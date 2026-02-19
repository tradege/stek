'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, TrendingUp, TrendingDown, Calculator, Percent, Package, ArrowDownLeft, ArrowUpRight, Download, RefreshCw } from 'lucide-react';
import config from '@/config/api';

interface ProviderBreakdown {
  name: string;
  feePercent: number;
  ggr: number;
  fee: number;
  games: string[];
}

interface GameBreakdown {
  game: string;
  bets: number;
  wins: number;
  ggr: number;
  count: number;
  rtp: string;
  provider: string;
  feePercent: number;
  fee: number;
}

interface FinanceData {
  totalBets: number;
  totalWins: number;
  betCount: number;
  ggr: number;
  providerFee: number;
  netProfit: number;
  houseEdge: string;
  rtp: string;
  deposits: number;
  withdrawals: number;
  netDeposits: number;
  gameBreakdown: GameBreakdown[];
  providerBreakdown: ProviderBreakdown[];
}

const API_URL = config.apiUrl;

export default function AdminFinance() {
  const { token } = useAuth();
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'games' | 'calculator'>('overview');

  const [customCalc, setCustomCalc] = useState({
    bets: '', wins: '', feePercent: '', result: null as any
  });

  useEffect(() => {
    if (token) fetchFinanceStats();
  }, [token]);

  const fetchFinanceStats = async () => {
    try {
      setLoading(true);
      const authToken = token || localStorage.getItem('auth_token');
      if (!authToken) throw new Error('No authentication token found');
      const response = await fetch(`${API_URL}/api/admin/finance/stats`, {
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setFinanceData({
        totalBets: data.totalBets ?? 0,
        totalWins: data.totalWins ?? 0,
        betCount: data.betCount ?? 0,
        ggr: data.ggr ?? 0,
        providerFee: data.providerFee ?? 0,
        netProfit: data.netProfit ?? 0,
        houseEdge: data.houseEdge ?? '0',
        rtp: data.rtp ?? '0',
        deposits: data.deposits ?? 0,
        withdrawals: data.withdrawals ?? 0,
        netDeposits: data.netDeposits ?? 0,
        gameBreakdown: data.gameBreakdown ?? [],
        providerBreakdown: data.providerBreakdown ?? [],
      });
      setError(null);
    } catch (error: any) {
      setError(error.message || 'Failed to load finance stats');
    } finally { setLoading(false); }
  };

  const calculateGGR = () => {
    const bets = parseFloat(customCalc.bets) || 0;
    const wins = parseFloat(customCalc.wins) || 0;
    const feePercent = parseFloat(customCalc.feePercent) || 0;
    const ggr = bets - wins;
    const providerFee = ggr > 0 ? ggr * (feePercent / 100) : 0;
    const netProfit = ggr - providerFee;
    const houseEdge = bets > 0 ? ((ggr / bets) * 100).toFixed(2) : '0';
    setCustomCalc({ ...customCalc, result: { ggr, providerFee, netProfit, houseEdge } });
  };

  const fmt = (val: number) => {
    if (Math.abs(val) >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(val) >= 1_000) return '$' + (val / 1_000).toFixed(2) + 'K';
    return '$' + val.toFixed(2);
  };

  const fmtFull = (val: number) => '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatGameName = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const exportCSV = () => {
    if (!financeData) return;
    const rows = [
      ['Metric', 'Value'],
      ['GGR', financeData.ggr.toFixed(2)],
      ['Provider Fees', financeData.providerFee.toFixed(2)],
      ['Net Profit', financeData.netProfit.toFixed(2)],
      ['Total Bets (Amount)', financeData.totalBets.toFixed(2)],
      ['Total Wins (Amount)', financeData.totalWins.toFixed(2)],
      ['Bet Count', financeData.betCount.toString()],
      ['House Edge %', financeData.houseEdge],
      ['RTP %', financeData.rtp],
      ['Total Deposits', financeData.deposits.toFixed(2)],
      ['Total Withdrawals', financeData.withdrawals.toFixed(2)],
      ['Net Deposits', financeData.netDeposits.toFixed(2)],
      ['', ''],
      ['Game', 'Bets', 'Wins', 'GGR', 'RTP', 'Provider', 'Fee%', 'Fee'],
      ...financeData.gameBreakdown.map(g => [
        formatGameName(g.game), g.bets.toFixed(2), g.wins.toFixed(2), g.ggr.toFixed(2),
        g.rtp + '%', g.provider, g.feePercent.toString(), g.fee.toFixed(2)
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `finance-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error || !financeData) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error || 'No data available'}</p>
        <button onClick={fetchFinanceStats} className="px-4 py-2 bg-accent-primary text-black rounded-lg hover:bg-accent-primary/90">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Finance & GGR</h1>
          <p className="text-text-secondary">Complete financial overview with per-provider breakdown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchFinanceStats} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={exportCSV} className="px-4 py-2 bg-accent-primary text-black rounded-lg hover:bg-accent-primary/90 font-medium flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ===== MONEY FLOW SECTION ===== */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Money Flow</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-text-secondary">Deposits</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{fmt(financeData.deposits)}</p>
            <p className="text-xs text-text-tertiary mt-1">Money in from players</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-text-secondary">Withdrawals</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">{fmt(financeData.withdrawals)}</p>
            <p className="text-xs text-text-tertiary mt-1">Money out to players</p>
          </div>
          <div className={`${financeData.netDeposits >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className={`w-4 h-4 ${financeData.netDeposits >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              <span className="text-xs text-text-secondary">Net Deposits</span>
            </div>
            <p className={`text-2xl font-bold ${financeData.netDeposits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {financeData.netDeposits >= 0 ? '+' : ''}{fmt(financeData.netDeposits)}
            </p>
            <p className="text-xs text-text-tertiary mt-1">Deposits - Withdrawals</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-text-secondary">Total Wagered</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{fmt(financeData.totalBets)}</p>
            <p className="text-xs text-text-tertiary mt-1">{financeData.betCount.toLocaleString()} bets placed</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-text-secondary">Total Payouts</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{fmt(financeData.totalWins)}</p>
            <p className="text-xs text-text-tertiary mt-1">Returned to players</p>
          </div>
        </div>
      </div>

      {/* ===== PROFIT SECTION ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-green-500/30 rounded-lg"><TrendingUp className="w-6 h-6 text-green-400" /></div>
            <div>
              <p className="text-gray-300 text-sm">Gross Gaming Revenue</p>
              <h3 className="text-3xl font-bold text-green-400">{fmt(financeData.ggr)}</h3>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">Total Bets - Total Payouts</p>
          <p className="text-xs text-gray-600 mt-1">Full: {fmtFull(financeData.ggr)}</p>
        </div>

        <div className={`bg-gradient-to-br ${financeData.providerFee > 0 ? 'from-red-500/20 to-red-600/10 border-red-500/30' : 'from-gray-500/10 to-gray-600/5 border-gray-500/30'} border rounded-xl p-6`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-3 ${financeData.providerFee > 0 ? 'bg-red-500/30' : 'bg-gray-500/20'} rounded-lg`}>
              <Package className={`w-6 h-6 ${financeData.providerFee > 0 ? 'text-red-400' : 'text-text-secondary'}`} />
            </div>
            <div>
              <p className="text-gray-300 text-sm">Provider Fees</p>
              <h3 className={`text-3xl font-bold ${financeData.providerFee > 0 ? 'text-red-400' : 'text-text-secondary'}`}>
                {fmt(financeData.providerFee)}
              </h3>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">
            {financeData.providerFee > 0 ? 'Per-provider fees on external games' : 'No external provider fees — all games in-house'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-accent-primary/20 to-accent-primary/5 border border-accent-primary/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-accent-primary/30 rounded-lg"><DollarSign className="w-6 h-6 text-accent-primary" /></div>
            <div>
              <p className="text-gray-300 text-sm">Net Profit (House)</p>
              <h3 className="text-3xl font-bold text-accent-primary">{fmt(financeData.netProfit)}</h3>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">GGR - Provider Fees</p>
          <p className="text-xs text-gray-600 mt-1">Full: {fmtFull(financeData.netProfit)}</p>
        </div>
      </div>

      {/* ===== METRICS ROW ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-white/10 rounded-lg p-5">
          <p className="text-text-secondary text-xs mb-1">House Edge</p>
          <p className="text-2xl font-bold text-white">{financeData.houseEdge}%</p>
          <p className="text-xs text-text-tertiary mt-1">Your advantage per bet</p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-5">
          <p className="text-text-secondary text-xs mb-1">RTP (Return to Player)</p>
          <p className="text-2xl font-bold text-white">{financeData.rtp}%</p>
          <p className="text-xs text-text-tertiary mt-1">% returned to players</p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-5">
          <p className="text-text-secondary text-xs mb-1">Total Bet Count</p>
          <p className="text-2xl font-bold text-white">{financeData.betCount.toLocaleString()}</p>
          <p className="text-xs text-text-tertiary mt-1">Number of bets placed</p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-lg p-5">
          <p className="text-text-secondary text-xs mb-1">Avg Bet Size</p>
          <p className="text-2xl font-bold text-white">
            {financeData.betCount > 0 ? fmt(financeData.totalBets / financeData.betCount) : '$0.00'}
          </p>
          <p className="text-xs text-text-tertiary mt-1">Average per bet</p>
        </div>
      </div>

      {/* ===== SECTION TABS ===== */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(['overview', 'games', 'calculator'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveSection(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeSection === tab ? 'text-accent-primary border-accent-primary' : 'text-text-secondary border-transparent hover:text-white'
            }`}>
            {tab === 'overview' ? 'Provider Breakdown' : tab === 'games' ? 'Per-Game Analysis' : 'GGR Calculator'}
          </button>
        ))}
      </div>

      {/* ===== PROVIDER BREAKDOWN ===== */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {financeData.providerBreakdown && financeData.providerBreakdown.length > 0 && (
            <div className="bg-bg-card border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-accent-primary" /> Provider Fee Breakdown
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-3 px-4 text-text-secondary text-sm font-medium">PROVIDER</th>
                      <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">FEE %</th>
                      <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">GGR</th>
                      <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">FEE AMOUNT</th>
                      <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">NET PROFIT</th>
                      <th className="py-3 px-4 text-text-secondary text-sm font-medium">GAMES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeData.providerBreakdown.map((p, i) => (
                      <tr key={i} className="border-b border-white/10/50 hover:bg-bg-main/50">
                        <td className="py-3 px-4 text-white font-medium">{p.name}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${p.feePercent > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                            {p.feePercent}%
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${p.ggr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt(p.ggr)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${p.fee > 0 ? 'text-red-400' : 'text-text-secondary'}`}>
                          {p.fee > 0 ? '-' + fmt(p.fee) : '$0.00'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-accent-primary">
                          {fmt(p.ggr - p.fee)}
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">
                          {p.games.map(formatGameName).join(', ')}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-bg-main/50 font-bold">
                      <td className="py-3 px-4 text-white">TOTAL</td>
                      <td className="py-3 px-4"></td>
                      <td className="py-3 px-4 text-right text-green-400">{fmt(financeData.ggr)}</td>
                      <td className="py-3 px-4 text-right text-red-400">
                        {financeData.providerFee > 0 ? '-' + fmt(financeData.providerFee) : '$0.00'}
                      </td>
                      <td className="py-3 px-4 text-right text-accent-primary">{fmt(financeData.netProfit)}</td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Formula Reference */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Financial Formulas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 text-gray-300 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <p><span className="text-green-400 font-bold">GGR</span> = Total Bets - Total Payouts</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <p><span className="text-red-400 font-bold">Provider Fee</span> = Per-game GGR x Provider Fee %</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent-primary rounded-full"></div>
                  <p><span className="text-accent-primary font-bold">Net Profit</span> = GGR - Total Provider Fees</p>
                </div>
              </div>
              <div className="space-y-3 text-gray-300 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <p><span className="text-blue-400 font-bold">House Edge</span> = (GGR / Total Bets) x 100%</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <p><span className="text-purple-400 font-bold">RTP</span> = 100% - House Edge</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <p><span className="text-emerald-400 font-bold">Net Deposits</span> = Deposits - Withdrawals</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-bg-main rounded-lg border border-white/10">
              <p className="text-xs text-text-secondary">
                <span className="text-accent-primary font-bold">Note:</span> Provider fees are calculated per-game based on each provider's fee percentage.
                In-house games (Platform Originals) have 0% fee. External providers (Pragmatic Play, Evolution Gaming) have their own rates.
                Fees are only charged on games with positive GGR.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== PER-GAME ANALYSIS ===== */}
      {activeSection === 'games' && financeData.gameBreakdown.length > 0 && (
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Per-Game Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium">GAME</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium">PROVIDER</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">BETS</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">PAYOUTS</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">GGR</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right"># BETS</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">RTP</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">FEE %</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">FEE</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">NET</th>
                </tr>
              </thead>
              <tbody>
                {financeData.gameBreakdown
                  .sort((a, b) => b.ggr - a.ggr)
                  .map((g, i) => (
                  <tr key={i} className="border-b border-white/10/50 hover:bg-bg-main/50">
                    <td className="py-3 px-4 text-white font-medium">{formatGameName(g.game)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        g.provider === 'internal' || g.provider === 'platform-originals' ? 'bg-green-500/20 text-green-400' :
                        g.provider === 'pragmatic-play' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>{g.provider}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-white">{fmt(g.bets)}</td>
                    <td className="py-3 px-4 text-right text-white">{fmt(g.wins)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${g.ggr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(g.ggr)}
                    </td>
                    <td className="py-3 px-4 text-right text-text-secondary">{g.count.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-white">{g.rtp}%</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${g.feePercent > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {g.feePercent}%
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${g.fee > 0 ? 'text-red-400' : 'text-text-secondary'}`}>
                      {g.fee > 0 ? '-' + fmt(g.fee) : '$0.00'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-accent-primary">
                      {fmt(g.ggr - g.fee)}
                    </td>
                  </tr>
                ))}
                {/* Totals */}
                <tr className="bg-bg-main/50 font-bold border-t-2 border-white/10">
                  <td className="py-3 px-4 text-white">TOTAL</td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right text-white">{fmt(financeData.totalBets)}</td>
                  <td className="py-3 px-4 text-right text-white">{fmt(financeData.totalWins)}</td>
                  <td className="py-3 px-4 text-right text-green-400">{fmt(financeData.ggr)}</td>
                  <td className="py-3 px-4 text-right text-text-secondary">{financeData.betCount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-white">{financeData.rtp}%</td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right text-red-400">
                    {financeData.providerFee > 0 ? '-' + fmt(financeData.providerFee) : '$0.00'}
                  </td>
                  <td className="py-3 px-4 text-right text-accent-primary">{fmt(financeData.netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== GGR CALCULATOR ===== */}
      {activeSection === 'calculator' && (
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="w-6 h-6 text-accent-primary" />
            <h2 className="text-xl font-bold text-white">GGR Calculator</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm text-text-secondary mb-2">Total Bets ($)</label>
              <input type="number" value={customCalc.bets} onChange={e => setCustomCalc({ ...customCalc, bets: e.target.value })}
                className="w-full bg-bg-main border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-primary"
                placeholder="Enter total bets amount" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Total Wins ($)</label>
              <input type="number" value={customCalc.wins} onChange={e => setCustomCalc({ ...customCalc, wins: e.target.value })}
                className="w-full bg-bg-main border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-primary"
                placeholder="Enter total wins amount" />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Provider Fee (%)</label>
              <input type="number" value={customCalc.feePercent} onChange={e => setCustomCalc({ ...customCalc, feePercent: e.target.value })}
                className="w-full bg-bg-main border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-primary"
                placeholder="e.g., 8 for 8%" />
            </div>
          </div>

          <button onClick={calculateGGR}
            className="w-full bg-accent-primary hover:bg-accent-primary/90 text-black font-bold py-3 rounded-lg transition-colors">
            Calculate GGR & Fees
          </button>

          {customCalc.result && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-bg-main border border-green-500/30 rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">GGR</p>
                <p className="text-2xl font-bold text-green-400">{fmtFull(customCalc.result.ggr)}</p>
              </div>
              <div className="bg-bg-main border border-red-500/30 rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">Provider Fee ({customCalc.feePercent || 0}%)</p>
                <p className="text-2xl font-bold text-red-400">{fmtFull(customCalc.result.providerFee)}</p>
              </div>
              <div className="bg-bg-main border border-accent-primary/30 rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">Net Profit</p>
                <p className="text-2xl font-bold text-accent-primary">{fmtFull(customCalc.result.netProfit)}</p>
              </div>
              <div className="bg-bg-main border border-blue-500/30 rounded-lg p-4">
                <p className="text-text-secondary text-sm mb-1">House Edge</p>
                <p className="text-2xl font-bold text-blue-400">{customCalc.result.houseEdge}%</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
