'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Statistic {
  id: string;
  type: 'TOTAL_WAGERED' | 'TOTAL_WON' | 'TOTAL_LOST' | 'GAMES_PLAYED' | 'BIGGEST_WIN';
  value: number;
  gameType?: string;
  createdAt: string;
}

export default function StatisticsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Statistic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch statistics from API
    const fetchStats = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/statistics/user`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Calculate summary stats
  const totalWagered = stats.find(s => s.type === 'TOTAL_WAGERED')?.value || 0;
  const totalWon = stats.find(s => s.type === 'TOTAL_WON')?.value || 0;
  const totalLost = stats.find(s => s.type === 'TOTAL_LOST')?.value || 0;
  const gamesPlayed = stats.find(s => s.type === 'GAMES_PLAYED')?.value || 0;
  const biggestWin = stats.find(s => s.type === 'BIGGEST_WIN')?.value || 0;
  const netProfit = totalWon - totalLost;
  const winRate = gamesPlayed > 0 ? ((totalWon / totalWagered) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📊 Statistics</h1>
          <p className="text-slate-400">Track your gaming performance</p>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            Loading statistics...
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Wagered */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-2xl">
                <div className="text-white/80 text-sm mb-2">💰 Total Wagered</div>
                <div className="text-3xl font-bold text-white">
                  ₮ {totalWagered.toFixed(2)}
                </div>
              </div>

              {/* Net Profit */}
              <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} rounded-2xl p-6 shadow-2xl`}>
                <div className="text-white/80 text-sm mb-2">
                  {netProfit >= 0 ? '📈' : '📉'} Net Profit
                </div>
                <div className="text-3xl font-bold text-white">
                  {netProfit >= 0 ? '+' : ''}₮ {netProfit.toFixed(2)}
                </div>
              </div>

              {/* Games Played */}
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-2xl">
                <div className="text-white/80 text-sm mb-2">🎮 Games Played</div>
                <div className="text-3xl font-bold text-white">
                  {gamesPlayed.toLocaleString()}
                </div>
              </div>

              {/* Biggest Win */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 shadow-2xl">
                <div className="text-white/80 text-sm mb-2">🏆 Biggest Win</div>
                <div className="text-3xl font-bold text-white">
                  ₮ {biggestWin.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">📈 Performance Metrics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Win Rate */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Win Rate</span>
                    <span className="text-2xl font-bold text-cyan-400">
                      {winRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div 
                      className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(winRate, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Total Won */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Won</span>
                    <span className="text-2xl font-bold text-green-400">
                      ₮ {totalWon.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Total Lost */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Lost</span>
                    <span className="text-2xl font-bold text-red-400">
                      ₮ {totalLost.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* VIP Progress */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">VIP Level</span>
                    <span className="text-2xl font-bold text-yellow-400">
                      {user?.vipLevel || 0}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    XP: {user?.xp || 0} / {((user?.vipLevel || 0) + 1) * 1000}
                  </div>
                </div>
              </div>
            </div>

            {/* Game Breakdown */}
            <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur">
              <h2 className="text-2xl font-bold text-white mb-6">🎯 Game Breakdown</h2>
              
              {stats.filter(s => s.gameType).length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <div className="text-6xl mb-4">🎲</div>
                  <p className="text-lg">No game statistics yet</p>
                  <p className="text-sm mt-2">Start playing to see your performance by game!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(new Set(stats.map(s => s.gameType).filter(Boolean))).map((gameType) => {
                    const gameStats = stats.filter(s => s.gameType === gameType);
                    const gameWagered = gameStats.find(s => s.type === 'TOTAL_WAGERED')?.value || 0;
                    const gameWon = gameStats.find(s => s.type === 'TOTAL_WON')?.value || 0;
                    const gamePlayed = gameStats.find(s => s.type === 'GAMES_PLAYED')?.value || 0;
                    
                    return (
                      <div key={gameType} className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-semibold text-lg">{gameType}</div>
                            <div className="text-slate-400 text-sm">{gamePlayed} games played</div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold">₮ {gameWagered.toFixed(2)}</div>
                            <div className={`text-sm ${gameWon >= gameWagered ? 'text-green-400' : 'text-red-400'}`}>
                              {gameWon >= gameWagered ? '+' : ''}₮ {(gameWon - gameWagered).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
