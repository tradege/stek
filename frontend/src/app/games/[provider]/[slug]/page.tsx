'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { getGameBySlug, launchGame, type Game } from '@/services/game.service';
import { useAuth } from '@/contexts/AuthContext';
import GameIframe from '@/components/game/GameIframe';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const slug = params.slug as string;
  
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  // Fetch game details
  useEffect(() => {
    async function fetchGame() {
      try {
        setLoading(true);
        const gameData = await getGameBySlug(slug);
        setGame(gameData);
      } catch (err) {
        console.error('Error fetching game:', err);
        setError('Failed to load game details');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchGame();
    }
  }, [slug]);

  // Launch game handler
  const handleLaunchGame = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      setLaunching(true);
      const response = await launchGame(slug);
      setGameUrl(response.url);
    } catch (err) {
      console.error('Error launching game:', err);
      alert('Failed to launch game. Please try again.');
    } finally {
      setLaunching(false);
    }
  };

  // Close game handler
  const handleCloseGame = () => {
    setGameUrl(null);
  };

  // Loading state
  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading game...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (error || !game) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <span className="text-6xl mb-4 block">😞</span>
            <h2 className="text-2xl font-bold text-white mb-2">Game Not Found</h2>
            <p className="text-gray-400 mb-6">{error || 'The game you are looking for does not exist.'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Game iframe is open
  if (gameUrl) {
    return (
      <GameIframe
        url={gameUrl}
        gameName={game.name}
        onClose={handleCloseGame}
        onError={(error) => {
          setError(error);
          setGameUrl(null);
        }}
      />
    );
  }

  // Game details page
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Game Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f212e] via-blue-900 to-cyan-900 border border-white/10">
          {game.banner && (
            <img
              src={game.banner}
              alt={game.name}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          
          <div className="relative px-8 py-12 md:py-16">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Game Thumbnail */}
              {game.thumbnail && (
                <div className="w-48 h-48 rounded-2xl overflow-hidden border-4 border-white/20 shadow-2xl flex-shrink-0">
                  <img
                    src={game.thumbnail}
                    alt={game.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Game Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm font-semibold">
                    {game.category}
                  </span>
                  <span className="px-3 py-1 bg-[#1475e1]/20 text-[#1475e1] rounded-full text-sm font-semibold">
                    {game.provider.name}
                  </span>
                  {game.isHot && (
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-semibold">
                      🔥 HOT
                    </span>
                  )}
                  {game.isNew && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-semibold">
                      ✨ NEW
                    </span>
                  )}
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
                  {game.name}
                </h1>

                {game.description && (
                  <p className="text-gray-300 mb-6 max-w-2xl">
                    {game.description}
                  </p>
                )}

                <button
                  onClick={handleLaunchGame}
                  disabled={launching || !game.isActive}
                  className={`px-8 py-4 font-bold rounded-xl transition-all text-lg ${
                    launching || !game.isActive
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg hover:shadow-cyan-500/50'
                  }`}
                >
                  {launching ? 'Launching...' : !game.isActive ? 'Coming Soon' : '🎮 Play Now'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {game.rtp && (
            <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
              <p className="text-3xl font-bold text-green-400 mb-1">{game.rtp}%</p>
              <p className="text-sm text-gray-400">RTP</p>
            </div>
          )}
          {game.volatility && (
            <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
              <p className="text-3xl font-bold text-yellow-400 mb-1">{game.volatility}</p>
              <p className="text-sm text-gray-400">Volatility</p>
            </div>
          )}
          {game.minBet && (
            <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
              <p className="text-3xl font-bold text-cyan-400 mb-1">${game.minBet}</p>
              <p className="text-sm text-gray-400">Min Bet</p>
            </div>
          )}
          {game.maxBet && (
            <div className="bg-bg-card border border-white/10 rounded-xl p-6 text-center">
              <p className="text-3xl font-bold text-[#1475e1] mb-1">${game.maxBet}</p>
              <p className="text-sm text-gray-400">Max Bet</p>
            </div>
          )}
        </div>

        {/* Provider Info */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">About the Provider</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {game.provider.name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{game.provider.name}</p>
              <p className="text-sm text-gray-400">Trusted Game Provider</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
