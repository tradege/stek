'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, TrendingUp, TrendingDown, Calculator, Users, Percent } from 'lucide-react';
import config from '@/config/api';

interface FinanceData {
  totalGGR: number;
  providerFees: number;
  netProfit: number;
  totalBets: number;
  totalWins: number;
  houseEdge: number;
  rtp: number;
}

const API_URL = config.apiUrl;

export default function AdminFinance() {
  const { token } = useAuth();
  const [financeData, setFinanceData] = useState<FinanceData>({
    totalGGR: 0,
    providerFees: 0,
    netProfit: 0,
    totalBets: 0,
    totalWins: 0,
    houseEdge: 0,
    rtp: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customCalc, setCustomCalc] = useState({
    bets: '',
    wins: '',
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
      if (!authToken) {
        throw new Error('No authentication token found');
      }

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
      setFinanceData(data);
      setLoading(false);
      setError(null);
    } catch (error: any) {
      // 'Failed to fetch finance stats:', error);
      setError(error.message || 'Failed to load finance stats');
      setLoading(false);
    }
  };

  const calculateGGR = () => {
    const bets = parseFloat(customCalc.bets) || 0;
    const wins = parseFloat(customCalc.wins) || 0;
    const ggr = bets - wins;
    const providerFee = ggr * 0.08;
    const netProfit = ggr - providerFee;
    const houseEdge = ((ggr / bets) * 100).toFixed(2);

    setCustomCalc({
      ...customCalc,
      result: {
        ggr,
        providerFee,
        netProfit,
        houseEdge
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-[#1475e1] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchFinanceStats}
            className="px-4 py-2 bg-[#1475e1] text-[#0f212e] rounded-lg hover:bg-[#1475e1]/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Finance & GGR</h1>
        <p className="text-gray-400">Track your casino financial performance and calculate GGR</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-300 text-sm">Gross Gaming Revenue</p>
              <h3 className="text-3xl font-bold text-green-400">
                ${financeData.totalGGR.toLocaleString()}
              </h3>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Total Bets - Total Wins
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-500/30 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-gray-300 text-sm">Provider Fees (8%)</p>
              <h3 className="text-3xl font-bold text-red-400">
                ${financeData.providerFees.toLocaleString()}
              </h3>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            8% of GGR to game providers
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
                ${financeData.netProfit.toLocaleString()}
              </h3>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            GGR - Provider Fees
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <p className="text-gray-400 text-sm">Total Bets</p>
          </div>
          <h4 className="text-2xl font-bold text-white">
            ${financeData.totalBets.toLocaleString()}
          </h4>
        </div>

        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-5 h-5 text-green-400" />
            <p className="text-gray-400 text-sm">Total Wins</p>
          </div>
          <h4 className="text-2xl font-bold text-white">
            ${financeData.totalWins.toLocaleString()}
          </h4>
        </div>

        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Percent className="w-5 h-5 text-[#1475e1]" />
            <p className="text-gray-400 text-sm">House Edge</p>
          </div>
          <h4 className="text-2xl font-bold text-white">
            {financeData.houseEdge}%
          </h4>
        </div>

        <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-[#1475e1]" />
            <p className="text-gray-400 text-sm">RTP</p>
          </div>
          <h4 className="text-2xl font-bold text-white">
            {financeData.rtp}%
          </h4>
        </div>
      </div>

      <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Calculator className="w-6 h-6 text-[#1475e1]" />
          <h2 className="text-xl font-bold text-white">GGR Calculator</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
              <p className="text-2xl font-bold text-green-400">
                ${customCalc.result.ggr.toLocaleString()}
              </p>
            </div>

            <div className="bg-[#0f212e] border border-red-500/30 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Provider Fee (8%)</p>
              <p className="text-2xl font-bold text-red-400">
                ${customCalc.result.providerFee.toLocaleString()}
              </p>
            </div>

            <div className="bg-[#0f212e] border border-yellow-500/30 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Net Profit</p>
              <p className="text-2xl font-bold text-[#1475e1]">
                ${customCalc.result.netProfit.toLocaleString()}
              </p>
            </div>

            <div className="bg-[#0f212e] border border-blue-500/30 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">House Edge</p>
              <p className="text-2xl font-bold text-blue-400">
                {customCalc.result.houseEdge}%
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1a2c38] border border-[#2f4553] rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">GGR Formula</h3>
        <div className="space-y-3 text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <p><span className="text-green-400 font-bold">GGR</span> = Total Bets - Total Wins</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <p><span className="text-red-400 font-bold">Provider Fee</span> = GGR × 8%</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#1475e1] rounded-full"></div>
            <p><span className="text-[#1475e1] font-bold">Net Profit</span> = GGR - Provider Fee</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <p><span className="text-blue-400 font-bold">House Edge</span> = (GGR / Total Bets) × 100%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
