'use client';

import { useEffect, useState } from 'react';
import { getAllGames, Game } from '@/services/game.service';
import GameCard from '@/components/ui/GameCard';

interface GameGridProps {
  category?: string;
  limit?: number;
}

export default function GameGrid({ category, limit }: GameGridProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const filters: any = {
          isActive: true,
        };
        
        if (category) {
          filters.category = category;
        }
        
        if (limit) {
          filters.limit = limit;
        }
        
        const response = await getAllGames(filters);
        setGames(response.data || []);
      } catch (err) {
        // 'Failed to load games:', err);
        setError('Failed to load games. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, [category, limit]);

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl bg-bg-card border border-white/10 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-block px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block px-6 py-4 bg-bg-card border border-white/10 rounded-xl">
          <p className="text-gray-400">No games available</p>
        </div>
      </div>
    );
  }

  // Map game category to icon
  const getGameIcon = (game: Game) => {
    if (game.slug === 'crash') return '🚀';
    if (game.slug === 'nova-rush') return '🛸';
    if (game.slug === 'dragon-blaze') return '🐉';
    if (game.slug === 'plinko') return '🎯';
    if (game.slug === 'dice') return '🎲';
    if (game.slug === 'mines') return '💣';
    if (game.category === 'SLOTS') return '🎰';
    if (game.category === 'LIVE_CASINO') return '🎴';
    return '🎮';
  };

  // Map game category to gradient
  const getGameGradient = (game: Game) => {
    if (game.slug === 'crash') return 'from-orange-600 to-red-600';
    if (game.slug === 'nova-rush') return 'from-blue-600 to-purple-600';
    if (game.slug === 'dragon-blaze') return 'from-red-600 to-orange-600';
    if (game.slug === 'plinko') return 'from-[#1475e1] to-[#1475e1]';
    if (game.slug === 'dice') return 'from-blue-600 to-cyan-600';
    if (game.slug === 'mines') return 'from-gray-700 to-gray-900';
    if (game.category === 'SLOTS') return 'from-yellow-600 to-orange-600';
    if (game.category === 'LIVE_CASINO') return 'from-green-600 to-emerald-600';
    return 'from-[#1475e1] to-[#1475e1]';
  };

  // Get game link
  const getGameLink = (game: Game) => {
    // Internal games (Crash, Plinko, Dice, Mines)
    if (game.category === 'CRASH') {
      return `/games/${game.slug}`;
    }
    
    // Slots games
    if (game.category === 'SLOTS') {
      return `/games/slots/${game.slug}`;
    }
    
    // Live Casino games
    if (game.category === 'LIVE_CASINO') {
      return `/games/live/${game.slug}`;
    }
    
    // Fallback
    return `/games/${game.slug}`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {games.map((game) => (
        <GameCard
          key={game.id}
          title={game.name}
          icon={getGameIcon(game)}
          gradient={getGameGradient(game)}
          link={getGameLink(game)}
          isLive={game.category === 'LIVE_CASINO'}
          isHot={game.isHot}
          isNew={game.isNew}
          isComingSoon={!game.isActive}
        />
      ))}
    </div>
  );
}
