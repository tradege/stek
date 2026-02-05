'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Games Layout - Protected Route
 * Requires authentication to access any game
 */
export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/games');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Don't render games if not authenticated
  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center bg-gray-900/80 border border-gray-700 rounded-xl p-8 max-w-md">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 mb-6">
              You need to be logged in to access the games.
            </p>
            <button
              onClick={() => router.push('/login?redirect=/games')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
            >
              Login to Play
            </button>
            <p className="text-gray-500 text-sm mt-4">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/register')}
                className="text-cyan-400 hover:text-cyan-300"
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Render games for authenticated users
  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}
