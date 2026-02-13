"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import config from '@/config/api';

interface GameBet {
  id: string;
  userId: string;
  username: string;
  isBot: boolean;
  gameType: string;
  currency: string;
  betAmount: string;
  multiplier: string;
  payout: string;
  profit: string;
  isWin: boolean;
  gameData: any;
  createdAt: string;
}

const API_URL = config.apiUrl;

const GAME_TYPES = ["ALL", "CRASH", "MINES", "PLINKO", "DICE", "LIMBO", "PENALTY", "OLYMPUS", "CARD_RUSH"];

const GAME_COLORS: Record<string, string> = {
  CRASH: "bg-red-500/20 text-red-400",
  MINES: "bg-yellow-500/20 text-yellow-400",
  PLINKO: "bg-blue-500/20 text-blue-400",
  DICE: "bg-purple-500/20 text-purple-400",
  LIMBO: "bg-pink-500/20 text-pink-400",
  PENALTY: "bg-green-500/20 text-green-400",
  OLYMPUS: "bg-amber-500/20 text-amber-400",
  CARD_RUSH: "bg-accent-primary/20 text-accent-primary",
};

export default function AdminGameHistoryPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [bets, setBets] = useState<GameBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState("ALL");
  const [minBet, setMinBet] = useState("");
  const [minWin, setMinWin] = useState("");
  const [showBots, setShowBots] = useState(true);
  const [limit, setLimit] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (user?.role !== "ADMIN") { router.push("/"); return; }
    fetchBets();
  }, [user, router]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchBets, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, gameFilter, minBet, minWin, limit]);

  const fetchBets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (gameFilter !== "ALL") params.set("gameType", gameFilter);
      if (minBet) params.set("minBet", minBet);
      if (minWin) params.set("minWin", minWin);
      params.set("limit", limit.toString());

      const res = await fetch(`${API_URL}/api/admin/game-history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      setBets(await res.json());
    } catch (err: any) { console.error(err); }
    setLoading(false);
  }, [token, gameFilter, minBet, minWin, limit]);

  const handleApplyFilters = () => { fetchBets(); };

  const displayBets = showBots ? bets : bets.filter(b => !b.isBot);

  // Stats
  const totalWagered = displayBets.reduce((s, b) => s + parseFloat(b.betAmount), 0);
  const totalPayout = displayBets.reduce((s, b) => s + parseFloat(b.payout), 0);
  const totalProfit = totalWagered - totalPayout;
  const winCount = displayBets.filter(b => b.isWin).length;
  const bigWins = displayBets.filter(b => parseFloat(b.payout) > 1000);

  const fmt = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Game Logs</h1>
          <p className="text-text-secondary">Real-time view of all bets across all games</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-accent-primary' : 'bg-card-hover'}`}
              onClick={() => setAutoRefresh(!autoRefresh)}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-text-secondary">Live</span>
            {autoRefresh && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
          </label>
          <button onClick={fetchBets} className="btn-secondary px-4 py-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Total Bets</div>
          <div className="text-2xl font-bold">{displayBets.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Total Wagered</div>
          <div className="text-2xl font-bold">${totalWagered.toFixed(2)}</div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Total Payout</div>
          <div className="text-2xl font-bold">${totalPayout.toFixed(2)}</div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">House Profit</div>
          <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-success-primary' : 'text-danger-primary'}`}>
            ${totalProfit.toFixed(2)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-text-secondary text-sm">Win Rate</div>
          <div className="text-2xl font-bold">
            {displayBets.length > 0 ? ((winCount / displayBets.length) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* Big Wins Alert */}
      {bigWins.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-4">
          <span className="text-2xl">🏆</span>
          <div>
            <h3 className="font-semibold text-amber-400">{bigWins.length} Big Win{bigWins.length > 1 ? 's' : ''} ($1,000+)</h3>
            <p className="text-sm text-text-secondary">
              Largest: ${Math.max(...bigWins.map(b => parseFloat(b.payout))).toFixed(2)} by {bigWins.sort((a, b) => parseFloat(b.payout) - parseFloat(a.payout))[0]?.username}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
          {/* Game Type */}
          <div className="flex gap-2 flex-wrap flex-1">
            {GAME_TYPES.map(g => (
              <button key={g} onClick={() => setGameFilter(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  gameFilter === g ? "bg-accent-primary text-text-inverse" : "bg-card-hover text-text-secondary hover:text-text-accent-primary"
                }`}>
                {g === "ALL" ? "All Games" : g.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Amount Filters */}
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-text-secondary block mb-1">Min Bet $</label>
              <input type="number" value={minBet} onChange={e => setMinBet(e.target.value)} placeholder="0"
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-accent-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Min Win $</label>
              <input type="number" value={minWin} onChange={e => setMinWin(e.target.value)} placeholder="0"
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-accent-primary focus:outline-none" />
            </div>
            <button onClick={handleApplyFilters}
              className="px-4 py-1.5 rounded-lg bg-accent-primary text-black text-sm font-medium hover:bg-accent-primary/80">
              Apply
            </button>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
              <input type="checkbox" checked={showBots} onChange={e => setShowBots(e.target.checked)}
                className="w-4 h-4 rounded border-white/30 bg-transparent text-accent-primary focus:ring-primary" />
              Show Bots
            </label>
            <select value={limit} onChange={e => { setLimit(parseInt(e.target.value)); }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-accent-primary focus:outline-none">
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card-hover">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Game</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">User</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Bet</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Multi</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Payout</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Profit</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary">Result</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {displayBets.map(b => {
                const profit = parseFloat(b.profit);
                const payout = parseFloat(b.payout);
                const isBigWin = payout > 1000;
                return (
                  <tr key={b.id} className={`hover:bg-card-hover transition-colors ${
                    isBigWin ? "bg-amber-500/5 border-l-2 border-l-amber-500" : ""
                  } ${b.isBot ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${GAME_COLORS[b.gameType] || "bg-white/10 text-text-secondary"}`}>
                        {b.gameType.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{b.username}</span>
                        {b.isBot && <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-text-secondary">BOT</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">${parseFloat(b.betAmount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{parseFloat(b.multiplier).toFixed(2)}x</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${isBigWin ? "text-amber-400" : "text-white"}`}>
                        ${payout.toFixed(2)}
                        {isBigWin && " 🏆"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${profit >= 0 ? 'text-success-primary' : 'text-danger-primary'}`}>
                      {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {b.isWin ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-success-primary/20 text-success-primary">WIN</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-danger-primary/20 text-danger-primary">LOSS</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-secondary">{fmt(b.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto"></div>
          </div>
        )}
        {!loading && displayBets.length === 0 && (
          <div className="p-8 text-center text-text-secondary">No game history found matching your filters</div>
        )}
      </div>
    </div>
  );
}
