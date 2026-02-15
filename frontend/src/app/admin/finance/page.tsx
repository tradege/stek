'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, TrendingUp, TrendingDown, Calculator, Users, Percent, Package } from 'lucide-react';
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

  const [customCalc, setCustomCalc] = useState({
    bets: '',
    wins: '',
    feePercent: '',
    result: null as any
  });

  useEffect(() => {
    if (token) {
      fetchFinanceStats();
    }
  }, [token]);

  const fetchFinanceStats = async () => {
    try {
      const authToken = token || localStorage.getItem('auth_token');
      if (!authToken) throw new Error('No authentication token found');

      const response = await fetch(`${API_URL}/api/admin/finance/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFinanceData({
        totalBets: data.totalBets ?? 0,
        totalWins: data.totalWins ?? 0,
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
      setLoading(false);
      setError(null);
    } catch (error: any) {
      setError(error.message || 'Failed to load finance stats');
      setLoading(false);
    }
  };

  const calculateGGR = () => {
    const bets = parseFloat(customCalc.bets) || 0;
    const wins = parseFloat(customCalc.wins) || 0;
    const feePercent = parseFloat(customCalc.feePercent) || 0;
    const ggr = bets - wins;
    const providerFee = ggr > 0 ? ggr * (feePercent / 100) : 0;
    const netProfit = ggr - providerFee;
    const houseEdge = bets > 0 ? ((ggr / bets) * 100).toFixed(2) : '0';

    setCustomCalc({
      ...customCalc,
      result: { ggr, providerFee, netProfit, houseEdge }
    });
  };

  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(val) >= 1_000) return '$' + (val / 1_000).toFixed(2) + 'K';
    return '$' + val.toFixed(2);
  };

  const formatGameName = (name: string) =>
    name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-[#1475e1] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !financeData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'No data available'}</p>
          <button onClick={fetchFinanceStats} className="px-4 py-2 bg-[#1475e1] text-[#0f212e] rounded-lg hover:bg-[#1475e1]/90">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Finance & GGR</h1>
        <p className="text-gray-400">Track your casino financial performance with per-provider fee breakdown</p>
      </div>

      {/* Top 3 cards: GGR, Provider Fees, Net Profit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-300 text-sm">Gross Gaming Revenue</p>
              <h3 className="text-3xl font-bold text-green-400">
                {formatCurrency(financeData.ggr)}
              </h3>
            </div>
          </div>
          <div className="text-sm text-gray-400">Total Bets - Total Wins</div>
        </div>

        <div className={`bg-gradient-to-br ${financeData.providerFee > 0 ? 'from-red-500/20 to-red-600/20 border-red-500/30' : 'from-gray-500/20 to-gray-600/20 border-gray-500/30'} border rounded-lg p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 ${financeData.providerFee > 0 ? 'bg-red-500/30' : 'bg-gray-500/30'} rounded-lg`}>
              <Package className={`w-6 h-6 ${financeData.providerFee > 0 ? 'text-red-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-gray-300 text-sm">Provider Fees</p>
              <h3 className={`text-3xl font-bold ${financeData.providerFee > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {formatCurrency(financeData.providerFee)}
              </h3>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            {financeData.providerFee > 0
              ? 'Per-provider fees on external games'
              : 'No external provider fees — all games in-house'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-500/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-[#1475e1]" />
            </div>
            <div>
              <p className="text-gray-300 text-sm">Net Profit (House)</p>
              <h3 className="text-3xl font-bold text-[#1475e1]">
                {formatCurrency(financeData.netProfit)}
              </h3>
            </div>
          </div>
          <div className="text-sm text-gray-400">GGR - Provider Fees</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <p className="text-gray-400 text-sm">Total Bets</p>
          </div>
          <h4 className="text-2xl font-bold text-white">${financeData.totalBets.toLocaleString()}</h4>
        </div>
        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-5 h-5 text-green-400" />
            <p className="text-gray-400 text-sm">Total Wins</p>
          </div>
          <h4 className="text-2xl font-bold text-white">${financeData.totalWins.toLocaleString()}</h4>
        </div>
        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Percent className="w-5 h-5 text-[#1475e1]" />
            <p className="text-gray-400 text-sm">House Edge</p>
          </div>
          <h4 className="text-2xl font-bold text-white">{financeData.houseEdge}%</h4>
        </div>
        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-[#1475e1]" />
            <p className="text-gray-400 text-sm">RTP</p>
          </div>
          <h4 className="text-2xl font-bold text-white">{financeData.rtp}%</h4>
        </div>
      </div>

      {/* Provider Breakdown Table */}
      {financeData.providerBreakdown && financeData.providerBreakdown.length > 0 && (
        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#1475e1]" />
            Provider Fee Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2f4553]">
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">PROVIDER</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">FEE %</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">GGR</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">FEE AMOUNT</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">GAMES</th>
                </tr>
              </thead>
              <tbody>
                {financeData.providerBreakdown.map((p, i) => (
                  <tr key={i} className="border-b border-[#2f4553]/50 hover:bg-[#0f212e]/50">
                    <td className="py-3 px-4 text-white font-medium">{p.name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.feePercent > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {p.feePercent}%
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-medium ${p.ggr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(p.ggr)}
                    </td>
                    <td className={`py-3 px-4 font-medium ${p.fee > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {p.fee > 0 ? '-' + formatCurrency(p.fee) : '$0.00'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-sm">
                      {p.games.map(formatGameName).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Game Breakdown Table */}
      {financeData.gameBreakdown && financeData.gameBreakdown.length > 0 && (
        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Per-Game Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2f4553]">
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">GAME</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">PROVIDER</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">BETS</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">WINS</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">GGR</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">RTP</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">FEE %</th>
                  <th className="py-3 px-4 text-gray-400 text-sm font-medium">FEE</th>
                </tr>
              </thead>
              <tbody>
                {financeData.gameBreakdown
                  .sort((a, b) => b.ggr - a.ggr)
                  .map((g, i) => (
                  <tr key={i} className="border-b border-[#2f4553]/50 hover:bg-[#0f212e]/50">
                    <td className="py-3 px-4 text-white font-medium">{formatGameName(g.game)}</td>
                    <td className="py-3 px-4 text-gray-400 text-sm">{g.provider || 'internal'}</td>
                    <td className="py-3 px-4 text-white">{formatCurrency(g.bets)}</td>
                    <td className="py-3 px-4 text-white">{formatCurrency(g.wins)}</td>
                    <td className={`py-3 px-4 font-medium ${g.ggr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(g.ggr)}
                    </td>
                    <td className="py-3 px-4 text-white">{g.rtp}%</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${g.feePercent > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                        {g.feePercent}%
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-medium ${g.fee > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {g.fee > 0 ? '-' + formatCurrency(g.fee) : '$0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GGR Calculator */}
      <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Calculator className="w-6 h-6 text-[#1475e1]" />
          <h2 className="text-xl font-bold text-white">GGR Calculator</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Total Bets ($)</label>
            <input
              type="number"
              value={customCalc.bets}
              onChange={(e) => setCustomCalc({ ...customCalc, bets: e.target.value })}
              className="w-full bg-[#0f212e] border border-[#2f4553] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#1475e1]"
              placeholder="Enter total bets amount"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Total Wins ($)</label>
            <input
              type="number"
              value={customCalc.wins}
              onChange={(e) => setCustomCalc({ ...customCalc, wins: e.target.value })}
              className="w-full bg-[#0f212e] border border-[#2f4553] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#1475e1]"
              placeholder="Enter total wins amount"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Provider Fee (%)</label>
            <input
              type="number"
              value={customCalc.feePercent}
              onChange={(e) => setCustomCalc({ ...customCalc, feePercent: e.target.value })}
              className="w-full bg-[#0f212e] border border-[#2f4553] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#1475e1]"
              placeholder="e.g., 8 for 8%"
            />
          </div>
        </div>

        <button
          onClick={calculateGGR}
          className="w-full bg-[#1475e1] hover:bg-[#1475e1]/90 text-[#0f212e] font-bold py-3 rounded-lg transition-colors"
        >
          Calculate GGR & Fees
        </button>

        {customCalc.result && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0f212e] border border-green-500/30 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">GGR</p>
              <p className="text-2xl font-bold text-green-400">${customCalc.result.ggr.toLocaleString()}</p>
            </div>
            <div className="bg-[#0f212e] border border-red-500/30 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Provider Fee ({customCalc.feePercent || 0}%)</p>
              <p className="text-2xl font-bold text-red-400">${customCalc.result.providerFee.toLocaleString()}</p>
            </div>
            <div className="bg-[#0f212e] border border-yellow-500/30 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Net Profit</p>
              <p className="text-2xl font-bold text-[#1475e1]">${customCalc.result.netProfit.toLocaleString()}</p>
            </div>
            <div className="bg-[#0f212e] border border-blue-500/30 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">House Edge</p>
              <p className="text-2xl font-bold text-blue-400">{customCalc.result.houseEdge}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Formula Reference */}
      <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">GGR Formula</h3>
        <div className="space-y-3 text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <p><span className="text-green-400 font-bold">GGR</span> = Total Bets - Total Wins</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <p><span className="text-red-400 font-bold">Provider Fee</span> = Per-game GGR × Provider Fee % (only on positive GGR)</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#1475e1] rounded-full"></div>
            <p><span className="text-[#1475e1] font-bold">Net Profit</span> = GGR - Total Provider Fees</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <p><span className="text-blue-400 font-bold">House Edge</span> = (GGR / Total Bets) × 100%</p>
          </div>
          <div className="mt-4 p-3 bg-[#0f212e] rounded-lg border border-[#2f4553]">
            <p className="text-sm text-gray-400">
              <span className="text-[#1475e1] font-bold">Note:</span> Provider fees are calculated per-game based on the fee percentage set for each game provider.
              In-house games (StakePro Originals) have 0% fee. External providers like Pragmatic Play or Evolution Gaming have their own fee rates.
              Fees are only charged on games with positive GGR.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
