'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="bg-bg-card border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-400 mb-6 text-sm">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-400 hover:to-blue-400 font-semibold transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
