'use client';
import React, { useEffect } from 'react';

interface WagerRacesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WagerRacesModal: React.FC<WagerRacesModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-bg-card rounded-xl border border-white/10 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-bg-card z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            Wager Races
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Active Race */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Weekly Race</h3>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-semibold">Active</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-bg-main rounded-lg p-3 text-center">
                <div className="text-text-secondary text-xs mb-1">Prize Pool</div>
                <div className="text-yellow-400 font-bold text-lg">$1,000</div>
              </div>
              <div className="bg-bg-main rounded-lg p-3 text-center">
                <div className="text-text-secondary text-xs mb-1">Participants</div>
                <div className="text-accent-primary font-bold text-lg">0</div>
              </div>
              <div className="bg-bg-main rounded-lg p-3 text-center">
                <div className="text-text-secondary text-xs mb-1">Time Left</div>
                <div className="text-white font-bold text-lg">6d 23h</div>
              </div>
            </div>
            <div className="text-center text-text-secondary text-sm py-4 border-t border-white/10">
              No participants yet. Start wagering to join the race!
            </div>
          </div>

          {/* Prize Distribution */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Prize Distribution</h3>
            <div className="space-y-2">
              {[
                { place: '🥇 1st Place', prize: '$500', color: 'text-yellow-400' },
                { place: '🥈 2nd Place', prize: '$250', color: 'text-gray-300' },
                { place: '🥉 3rd Place', prize: '$125', color: 'text-orange-400' },
                { place: '4th - 10th', prize: '$125 split', color: 'text-text-secondary' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-bg-main rounded-lg">
                  <span className="text-white text-sm font-medium">{item.place}</span>
                  <span className={`font-bold text-sm ${item.color}`}>{item.prize}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">How It Works</h3>
            <div className="space-y-3">
              {[
                { num: '1', text: 'Place bets on any game to accumulate wager points' },
                { num: '2', text: 'The more you wager, the higher you climb on the leaderboard' },
                { num: '3', text: 'Top players at the end of the race win prizes from the pool' },
                { num: '4', text: 'New races start automatically every week' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {step.num}
                  </span>
                  <p className="text-text-secondary text-sm">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WagerRacesModal;
