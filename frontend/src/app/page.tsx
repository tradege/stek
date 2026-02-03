'use client';

import MainLayout from '@/components/layout/MainLayout';
import CrashGamePanel from '@/components/games/CrashGamePanel';
import { useSocket } from '@/contexts/SocketContext';

export default function Home() {
  const { isConnected, connectionError } = useSocket();

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Crash Game</h1>
          <p className="text-text-secondary">
            Place your bet and cash out before the crash!
          </p>
        </div>

        {/* Connection Error Banner */}
        {connectionError && (
          <div className="mb-4 p-4 bg-danger-muted border border-danger-primary/30 rounded-lg">
            <p className="text-danger-primary text-sm">
              ⚠️ Connection Error: {connectionError}
            </p>
          </div>
        )}

        {/* Main Game Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Panel - Takes 2 columns */}
          <div className="lg:col-span-2">
            <CrashGamePanel />
          </div>

          {/* Side Panel - Chat & Bets */}
          <div className="space-y-6">
            {/* Live Bets */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Live Bets</h3>
                <span className="badge-cyan text-xs">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <div className="card-body max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {/* Sample bets - would be real data from socket */}
                  {[
                    { user: 'CryptoKing', amount: 500, multiplier: null },
                    { user: 'LuckyPlayer', amount: 250, multiplier: 2.34 },
                    { user: 'Whale123', amount: 1000, multiplier: null },
                    { user: 'BetMaster', amount: 100, multiplier: 1.87 },
                    { user: 'Anonymous', amount: 50, multiplier: null },
                  ].map((bet, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        bet.multiplier ? 'bg-success-muted' : 'bg-card-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent-muted flex items-center justify-center text-xs">
                          {bet.user[0]}
                        </div>
                        <span className="text-sm">{bet.user}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono">${bet.amount}</p>
                        {bet.multiplier && (
                          <p className="text-xs text-success-primary">
                            @{bet.multiplier}x
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Chat</h3>
                <span className="text-xs text-text-secondary">128 online</span>
              </div>
              <div className="card-body">
                <div className="h-48 overflow-y-auto space-y-2 mb-3">
                  {[
                    { user: 'Player1', msg: 'GL everyone! 🍀' },
                    { user: 'CryptoFan', msg: 'That was close!' },
                    { user: 'Winner99', msg: 'Just hit 5x! 🚀' },
                  ].map((chat, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-accent-primary font-medium">
                        {chat.user}:
                      </span>{' '}
                      <span className="text-text-secondary">{chat.msg}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="input flex-1 text-sm py-2"
                  />
                  <button className="btn-primary px-4 py-2">Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-accent-primary tabular-nums">$1.2M</p>
            <p className="text-sm text-text-secondary">Total Wagered</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-success-primary tabular-nums">12,847</p>
            <p className="text-sm text-text-secondary">Games Played</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-warning-primary tabular-nums">156.32x</p>
            <p className="text-sm text-text-secondary">Highest Win</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">2,341</p>
            <p className="text-sm text-text-secondary">Active Players</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
