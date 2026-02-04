'use client';

import React from 'react';
import Link from 'next/link';

interface GameCardProps {
  title: string;
  image?: string;
  icon?: React.ReactNode;
  link?: string;
  isLive?: boolean;
  isComingSoon?: boolean;
  isHot?: boolean;
  gradient?: string;
}

const GameCard: React.FC<GameCardProps> = ({
  title,
  image,
  icon,
  link,
  isLive = false,
  isComingSoon = false,
  isHot = false,
  gradient = 'from-purple-600 via-blue-600 to-cyan-500',
}) => {
  const cardContent = (
    <div
      className={`
        relative group overflow-hidden rounded-2xl
        bg-gradient-to-br ${gradient}
        border border-white/10
        transition-all duration-300 ease-out
        ${!isComingSoon ? 'hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20 cursor-pointer' : 'opacity-70 cursor-not-allowed'}
      `}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)]" />
      </div>

      {/* Card Content */}
      <div className="relative p-6 h-48 flex flex-col items-center justify-center">
        {/* Live Badge */}
        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-green-500/90 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
        )}

        {/* Hot Badge */}
        {isHot && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-orange-500/90 rounded-full">
            <span className="text-xs font-bold text-white">🔥 HOT</span>
          </div>
        )}

        {/* Coming Soon Badge */}
        {isComingSoon && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-gray-600/90 rounded-full">
            <span className="text-xs font-bold text-white">SOON</span>
          </div>
        )}

        {/* Icon or Image */}
        <div className="mb-4 text-5xl">
          {icon ? (
            icon
          ) : image ? (
            <img src={image} alt={title} className="w-16 h-16 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-3xl">🎮</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center">{title}</h3>

        {/* Play Button - Shows on Hover */}
        {!isComingSoon && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="px-6 py-3 bg-cyan-500 rounded-xl font-bold text-white transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-lg shadow-cyan-500/50">
              Play Now
            </div>
          </div>
        )}

        {/* Coming Soon Overlay */}
        {isComingSoon && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="px-4 py-2 bg-gray-800/80 rounded-lg">
              <span className="text-sm font-medium text-gray-300">Coming Soon</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (link && !isComingSoon) {
    return (
      <Link href={link} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
};

export default GameCard;
