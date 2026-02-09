'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, Component, ReactNode, ErrorInfo } from 'react';
import LiveBets from '@/components/games/LiveBets';
import { useSocket } from '@/contexts/SocketContext';
import config from '@/config/api';

// Error Boundary
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class GameErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Game Error</h2>
          <p className="text-gray-400 mb-4">{this.state.error?.message || 'Something went wrong'}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-400 font-semibold">
            Reload Game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DragonBlazeGame = dynamic(
  () => import('@/components/games/DragonBlazeGame'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-[#1a0a00] rounded-xl border border-orange-800/30 p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-400 mb-4"></div>
        <p className="text-gray-400 text-lg">Awakening Dragons...</p>
        <p className="text-gray-500 text-sm mt-2">Preparing Battle Arena</p>
      </div>
    ),
  }
);

const API_URL = config.apiUrl;

export default function DragonBlazePage() {
  const { socket, isConnected, connectionError } = useSocket();
  
  const [gameStats, setGameStats] = useState({
    totalWagered: 0,
    gamesPlayed: 0,
    highestWin: 0,
    activePlayers: 0,
  });

  useEffect(() => {
    if (!socket) return;
    const handleCrashed = (data: { crashPoint: string | number; gameNumber?: number }) => {
      try {
        const crashPoint = typeof data.crashPoint === 'string' ? parseFloat(data.crashPoint) : data.crashPoint;
        if (!isNaN(crashPoint)) {
          setGameStats(prev => ({
            ...prev,
            gamesPlayed: prev.gamesPlayed + 1,
            highestWin: Math.max(prev.highestWin, crashPoint),
          }));
        }
      } catch (err) {}
    };
    socket.on('crash:crashed', handleCrashed);
    return () => { socket.off('crash:crashed', handleCrashed); };
  }, [socket]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/admin/stats`);
        if (response.ok) {
          const data = await response.json();
          setGameStats(prev => ({
            ...prev,
            totalWagered: data.totalDeposits || 0,
            gamesPlayed: data.totalBets || 0,
            activePlayers: data.activeUsers || 0,
          }));
        }
      } catch (err) {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">Dragon Blaze</h1>
        <p className="text-text-secondary">Two dragons fly toward the city — dodge the arrows and cash out before they fall!</p>
      </div>

      {connectionError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">⚠️ Connection Error: {connectionError}</p>
        </div>
      )}

      <GameErrorBoundary>
        <DragonBlazeGame />
      </GameErrorBoundary>

      <LiveBets />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400 tabular-nums">{formatNumber(gameStats.totalWagered)}</p>
          <p className="text-sm text-text-secondary">Total Wagered</p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400 tabular-nums">{gameStats.gamesPlayed.toLocaleString()}</p>
          <p className="text-sm text-text-secondary">Battles Fought</p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400 tabular-nums">{gameStats.highestWin.toFixed(2)}x</p>
          <p className="text-sm text-text-secondary">Highest Flight</p>
        </div>
        <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400 tabular-nums">{gameStats.activePlayers.toLocaleString()}</p>
          <p className="text-sm text-text-secondary">Dragon Riders</p>
        </div>
      </div>
    </div>
  );
}
