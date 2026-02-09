'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, AlertCircle } from 'lucide-react';

interface GameIframeProps {
  url: string;
  gameName: string;
  onClose?: () => void;
  onError?: (error: string) => void;
}

export default function GameIframe({ url, gameName, onClose, onError }: GameIframeProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle iframe load
  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  // Handle iframe error
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.('Failed to load game. Please try again later.');
  };

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      // 'Fullscreen error:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black"
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Game Title */}
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <h1 className="text-white font-bold text-lg">{gameName}</h1>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>

            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors text-red-400"
                title="Close Game"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">Loading {gameName}...</p>
            <p className="text-gray-400 text-sm mt-2">Please wait</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {hasError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Failed to Load Game</h2>
            <p className="text-gray-400 mb-6">
              We couldn't load {gameName}. This might be due to network issues or the game provider being temporarily unavailable.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                  if (iframeRef.current) {
                    iframeRef.current.src = url;
                  }
                }}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors"
              >
                Try Again
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Iframe */}
      <iframe
        ref={iframeRef}
        src={url}
        title={gameName}
        className="w-full h-full border-0"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="fullscreen; payment; autoplay; clipboard-write; encrypted-media; gyroscope; accelerometer; microphone; camera"
        allowFullScreen
      />

      {/* Bottom Info Bar (only in fullscreen) */}
      {isFullscreen && (
        <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-white/60 text-sm">
              Press <kbd className="px-2 py-1 bg-white/20 rounded text-white">ESC</kbd> to exit fullscreen
            </p>
            <p className="text-white/60 text-sm">
              StakePro • Crypto Casino
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
