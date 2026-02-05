'use client';

import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [clientSeed, setClientSeed] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSound = localStorage.getItem('soundEnabled');
      const savedMusic = localStorage.getItem('musicEnabled');
      const savedSeed = localStorage.getItem('clientSeed');
      
      if (savedSound !== null) setSoundEnabled(savedSound === 'true');
      if (savedMusic !== null) setMusicEnabled(savedMusic === 'true');
      if (savedSeed) setClientSeed(savedSeed);
      else {
        // Generate random client seed if not exists
        const newSeed = generateRandomSeed();
        setClientSeed(newSeed);
        localStorage.setItem('clientSeed', newSeed);
      }
    }
  }, [isOpen]);

  const generateRandomSeed = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('soundEnabled', String(newValue));
  };

  const handleMusicToggle = () => {
    const newValue = !musicEnabled;
    setMusicEnabled(newValue);
    localStorage.setItem('musicEnabled', String(newValue));
  };

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSeed = e.target.value;
    setClientSeed(newSeed);
    localStorage.setItem('clientSeed', newSeed);
  };

  const handleRandomizeSeed = () => {
    const newSeed = generateRandomSeed();
    setClientSeed(newSeed);
    localStorage.setItem('clientSeed', newSeed);
  };

  const handleCopySeed = () => {
    navigator.clipboard.writeText(clientSeed);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-bg-card border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <svg className="w-6 h-6 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Sound Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Audio</h3>
            
            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Sound Effects</p>
                  <p className="text-text-secondary text-sm">Game sounds and notifications</p>
                </div>
              </div>
              <button
                onClick={handleSoundToggle}
                className={`relative w-14 h-7 rounded-full transition-colors ${soundEnabled ? 'bg-accent-primary' : 'bg-white/20'}`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-7' : ''}`} />
              </button>
            </div>

            {/* Music Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1475e1]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#1475e1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Background Music</p>
                  <p className="text-text-secondary text-sm">Ambient game music</p>
                </div>
              </div>
              <button
                onClick={handleMusicToggle}
                className={`relative w-14 h-7 rounded-full transition-colors ${musicEnabled ? 'bg-purple-500' : 'bg-white/20'}`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${musicEnabled ? 'translate-x-7' : ''}`} />
              </button>
            </div>
          </div>

          {/* Provably Fair Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Provably Fair</h3>
            
            {/* Client Seed */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white font-medium">Client Seed</p>
                <button
                  onClick={handleRandomizeSeed}
                  className="text-accent-primary text-sm hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Randomize
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientSeed}
                  onChange={handleSeedChange}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm font-mono focus:outline-none focus:border-accent-primary/50"
                  placeholder="Enter your client seed"
                />
                <button
                  onClick={handleCopySeed}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Copy seed"
                >
                  {isCopied ? (
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-text-secondary text-xs">
                Your client seed is combined with the server seed to generate provably fair game results.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5">
          <button
            onClick={onClose}
            className="w-full py-3 bg-accent-primary hover:bg-accent-primary/90 text-black font-semibold rounded-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
