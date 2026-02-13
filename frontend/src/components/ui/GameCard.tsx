"use client";
import React, { useState } from "react";
import Link from "next/link";

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
  gradient = "from-[#1475e1] via-[#1475e1] to-[#1475e1]",
  players,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const testId = title.toLowerCase().replace(/\s+/g, "-");

  const cardInner = (
    <>
      {/* Animated background particles */}
      <div className="absolute inset-0 opacity-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        {isHovered && (
          <>
            <div className="particle" style={{ left: '10%', top: '20%', animationDelay: '0s' }} />
            <div className="particle" style={{ left: '30%', top: '60%', animationDelay: '0.5s' }} />
            <div className="particle" style={{ left: '70%', top: '30%', animationDelay: '1s' }} />
            <div className="particle" style={{ left: '90%', top: '70%', animationDelay: '1.5s' }} />
          </>
        )}
      </div>

      {/* Glow effect on hover */}
      {isHovered && !isComingSoon && (
        <div className="absolute inset-0 bg-gradient-to-t from-accent-primary/20 to-transparent animate-fade-in" />
      )}

      <div className="relative p-6 h-48 flex flex-col items-center justify-center">
        {/* Live badge with pulse animation */}
        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-green-500/90 rounded-full animate-badge-pulse">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
        )}

        {/* Hot badge with glow */}
        {isHot && !isNew && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-orange-500/90 rounded-full hover-glow-yellow">
            <span className="text-xs font-bold text-white">🔥 HOT</span>
          </div>
        )}

        {/* New badge with pulse */}
        {isNew && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/90 rounded-full animate-badge-pulse">
            <span className="text-xs font-bold text-white">✨ NEW</span>
          </div>
        )}

        {/* Coming Soon badge */}
        {isComingSoon && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-gray-600/90 rounded-full">
            <span className="text-xs font-bold text-white">SOON</span>
          </div>
        )}

        {/* Icon with animation */}
        <div className={`mb-4 text-5xl transform transition-all duration-500 ${
          isHovered ? 'scale-125 animate-icon-bounce' : 'scale-100'
        }`}>
          {icon || <span>🎮</span>}
        </div>

        {/* Title with shimmer on hover */}
        <h3 className={`text-xl font-bold text-white text-center drop-shadow-lg transition-all duration-300 ${
          isHovered && !isComingSoon ? 'text-shimmer' : ''
        }`}>
          {title}
        </h3>

        {/* Players count */}
        {players && players > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-gray-300">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>{players} playing</span>
          </div>
        )}

        {/* Play Now overlay with animation */}
        {!isComingSoon && isHovered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 animate-fade-in">
            <div className="px-6 py-3 bg-gradient-to-r from-primary to-blue-500 rounded-xl font-bold text-white shadow-lg transform hover:scale-105 transition-transform btn-pulse-glow">
              Play Now
            </div>
          </div>
        )}

        {/* Coming Soon overlay */}
        {isComingSoon && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="px-4 py-2 bg-gray-800/80 rounded-lg backdrop-blur-sm">
              <span className="text-sm font-medium text-gray-300">Coming Soon</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom shine effect */}
      {isHovered && !isComingSoon && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-fade-in" />
      )}
    </>
  );

  // Allow links for both active games and coming soon games
  if (link) {
    return (
      <Link 
        href={link}
        data-testid={`game-card-${testId}`}
        className={`block relative group overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20 hover-lift ${isComingSoon ? "opacity-80" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {cardInner}
      </Link>
    );
  }

  return (
    <div
      data-testid={`game-card-${testId}`}
      className={`relative group overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 opacity-70 cursor-not-allowed`}
    >
      {cardInner}
    </div>
  );
};

export default GameCard;
