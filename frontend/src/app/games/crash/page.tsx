'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, Component, ReactNode, ErrorInfo } from 'react';

import LiveBets from '@/components/games/LiveBets';
import { useSocket } from '@/contexts/SocketContext';

// Error Boundary Component to catch and display errors gracefully
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GameErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Game Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Game Error</h2>
          <p className="text-gray-400 mb-4">{this.state.error?.message || 'Something went wrong'}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 font-semibold"
          >
            Reload Game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Dynamic import with SSR disabled to prevent Audio/Canvas issues
const CrashGamePanel = dynamic(
  () => import('@/components/games/CrashGamePanel'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mb-4"></div>
        <p className="text-gray-400 text-lg">Loading Game Engine...</p>
        <p className="text-gray-500 text-sm mt-2">Initializing Canvas & Audio</p>
      </div>
    ),
  }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://146.190.21.113:3000';

export default function CrashGamePage() {
  const { socket, isConnected, connectionError } = useSocket();
  
  // Game stats - updated from socket events
  const [gameStats, setGameStats] = useState({
    totalWagered: 0,
    gamesPlayed: 0,
    highestWin: 0,
    activePlayers: 0,
  });

  // Listen for crash events to update stats only (history is handled in CrashGamePanel)
  useEffect(() => {
    if (!socket) return;

    const handleCrashed = (data: { crashPoint: string | number; gameNumber?: number }) => {
      try {
        const crashPoint = typeof data.crashPoint === 'string' 
          ? parseFloat(data.crashPoint) 
          : data.crashPoint;
        
        if (!isNaN(crashPoint)) {
          // Update game stats only - history is handled in CrashGamePanel
          setGameStats(prev => ({
            ...prev,
            gamesPlayed: prev.gamesPlayed + 1,
            highestWin: Math.max(prev.highestWin, crashPoint),
          }));
        }
      } catch (err) {
        console.error('Error handling crash event:', err);
      }
    };

    socket.on('crash:crashed', handleCrashed);

    return () => {
      socket.off('crash:crashed', handleCrashed);
    };
  }, [socket]);

  // Fetch game stats from API
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
      } catch (err) {
        console.error('Failed to fetch game stats:', err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);


  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Crash Game</h1>
          <p className="text-text-secondary">
            Place your bet and cash out before the crash!
          </p>
        </div>

        {/* Connection Error Banner */}
        {connectionError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm">
              ⚠️ Connection Error: {connectionError}
            </p>
          </div>
        )}

        {/* Main Game Panel - Wrapped in Error Boundary */}
        <GameErrorBoundary>
          <CrashGamePanel />
        </GameErrorBoundary>

        {/* Live Bets Table */}
        <LiveBets />

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-accent-primary tabular-nums">
              {formatNumber(gameStats.totalWagered)}
            </p>
            <p className="text-sm text-text-secondary">Total Wagered</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400 tabular-nums">
              {gameStats.gamesPlayed.toLocaleString()}
            </p>
            <p className="text-sm text-text-secondary">Games Played</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400 tabular-nums">
              {gameStats.highestWin.toFixed(2)}x
            </p>
            <p className="text-sm text-text-secondary">Highest Win</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-[#1475e1] tabular-nums">
              {gameStats.activePlayers.toLocaleString()}
            </p>
            <p className="text-sm text-text-secondary">Active Players</p>
          </div>
        </div>

        {/* Recent Crashes History is shown inside CrashGamePanel */}
      </div>
  );
}
