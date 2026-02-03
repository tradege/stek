'use client';

import MainLayout from '@/components/layout/MainLayout';
import CrashGamePanel from '@/components/games/CrashGamePanel';
import LiveBets from '@/components/games/LiveBets';
import { useSocket } from '@/contexts/SocketContext';

export default function Home() {
  const { isConnected, connectionError } = useSocket();

  return (
    <MainLayout>
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

        {/* Main Game Panel */}
        <CrashGamePanel />

        {/* Live Bets Table */}
        <LiveBets />

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-accent-primary tabular-nums">$1.2M</p>
            <p className="text-sm text-text-secondary">Total Wagered</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400 tabular-nums">12,847</p>
            <p className="text-sm text-text-secondary">Games Played</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400 tabular-nums">156.32x</p>
            <p className="text-sm text-text-secondary">Highest Win</p>
          </div>
          <div className="bg-bg-card border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white tabular-nums">2,341</p>
            <p className="text-sm text-text-secondary">Active Players</p>
          </div>
        </div>

        {/* Recent Crashes History */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-3">Recent Crashes</h3>
          <div className="flex flex-wrap gap-2">
            {[2.34, 1.12, 5.67, 1.89, 3.45, 1.05, 8.92, 2.11, 1.43, 4.56, 1.78, 6.23].map((crash, i) => (
              <span
                key={i}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono tabular-nums ${
                  crash >= 2
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {crash.toFixed(2)}x
              </span>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
