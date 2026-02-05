'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface GameCardProps {
  title: string;
  image?: string;
  icon?: React.ReactNode;
  link?: string;
  isLive?: boolean;
  isComingSoon?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  gradient?: string;
  players?: number;
}

const GameCard: React.FC<GameCardProps> = ({
  title,
  image,
  icon,
  link,
  isLive = false,
  isComingSoon = false,
  isHot = false,
  isNew = false,
  gradient = 'from-purple-600 via-blue-600 to-cyan-500',
  players,
}) => {
  const [isActive, setIsActive] = useState(false);
  const router = useRouter();

  const handleMouseDown = () => {
    if (!isComingSoon) {
      setIsActive(true);
    }
  };

  const handleMouseUp = () => {
    setIsActive(false);
  };

  const handleMouseLeave = () => {
    setIsActive(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (link && !isComingSoon) {
      e.preventDefault();
      router.push(link);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && link && !isComingSoon) {
      e.preventDefault();
      router.push(link);
    }
  };

  // Generate testid from title
  const testId = title.toLowerCase().replace(/\s+/g, '-');

  const cardContent = (
    <div
      data-testid={`game-card-${testId}`}
      className={`
        relative group overflow-hidden rounded-2xl
        bg-gradient-to-br ${gradient}
        border border-white/10
        transition-all duration-300 ease-out
        ${!isComingSoon 
          ? `hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20 cursor-pointer ${isActive ? 'scale-95 shadow-inner' : ''}` 
          : 'opacity-70 cursor-not-allowed'}
      `}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isComingSoon ? -1 : 0}
      aria-disabled={isComingSoon}
      aria-label={`${title} game${isComingSoon ? ' - Coming Soon' : ''}`}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)]" />
      </div>

      {/* Active State Overlay */}
      {isActive && (
        <div data-testid={`game-card-${testId}-active`} className="absolute inset-0 bg-white/10 z-10 transition-opacity duration-150 pointer-events-none" />
      )}

      {/* Card Content */}
      <div className="relative p-6 h-48 flex flex-col items-center justify-center pointer-events-none">
        {/* Live Badge */}
        {isLive && (
          <div data-testid={`game-card-${testId}-live-badge`} className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-green-500/90 rounded-full shadow-lg shadow-green-500/30">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
        )}

        {/* Hot Badge */}
        {isHot && !isNew && (
          <div data-testid={`game-card-${testId}-hot-badge`} className="absolute top-3 right-3 px-2 py-1 bg-orange-500/90 rounded-full shadow-lg shadow-orange-500/30">
            <span className="text-xs font-bold text-white">🔥 HOT</span>
          </div>
        )}

        {/* New Badge */}
        {isNew && (
          <div data-testid={`game-card-${testId}-new-badge`} className="absolute top-3 right-3 px-2 py-1 bg-blue-500/90 rounded-full shadow-lg shadow-blue-500/30 animate-pulse">
            <span className="text-xs font-bold text-white">✨ NEW</span>
          </div>
        )}

        {/* Coming Soon Badge */}
        {isComingSoon && (
          <div data-testid={`game-card-${testId}-soon-badge`} className="absolute top-3 right-3 px-2 py-1 bg-gray-600/90 rounded-full">
            <span className="text-xs font-bold text-white">SOON</span>
          </div>
        )}

        {/* Players Count */}
        {players !== undefined && players > 0 && !isComingSoon && (
          <div data-testid={`game-card-${testId}-players`} className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/40 rounded-full backdrop-blur-sm">
            <span className="text-xs text-gray-300">👥</span>
            <span className="text-xs font-medium text-white">{players.toLocaleString()}</span>
          </div>
        )}

        {/* Icon or Image */}
        <div data-testid={`game-card-${testId}-icon`} className="mb-4 text-5xl transform transition-transform duration-300 group-hover:scale-110">
          {icon ? (
            icon
          ) : image ? (
            <img src={image} alt={title} className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <span className="text-3xl">🎮</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 data-testid={`game-card-${testId}-title`} className="text-xl font-bold text-white text-center drop-shadow-lg">{title}</h3>

        {/* Play Button - Shows on Hover */}
        {!isComingSoon && (
          <div data-testid={`game-card-${testId}-play-overlay`} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div 
              data-testid={`game-card-${testId}-play-btn`}
              className={`
                px-6 py-3 bg-cyan-500 rounded-xl font-bold text-white 
                transform transition-all duration-300 
                shadow-lg shadow-cyan-500/50
                ${isActive ? 'scale-90 bg-cyan-600' : 'scale-90 group-hover:scale-100'}
              `}
            >
              Play Now
            </div>
          </div>
        )}

        {/* Coming Soon Overlay */}
        {isComingSoon && (
          <div data-testid={`game-card-${testId}-coming-soon-overlay`} className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <div className="px-4 py-2 bg-gray-800/80 rounded-lg border border-gray-700/50">
              <span className="text-sm font-medium text-gray-300">Coming Soon</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return cardContent;
};

export default GameCard;
