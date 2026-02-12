'use client';
import React, { useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useRouter } from 'next/navigation';
import FullPageLoader from '@/components/ui/FullPageLoader';

/**
 * Sports Layout - Uses the same auth pattern as Games Layout
 * When a guest tries to access any sports page, they are redirected to home
 * and the global Login Modal opens automatically.
 * No custom overlays - uses the exact same Login Modal everywhere.
 */
export default function SportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { openLogin } = useModal();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
      openLogin();
    }
  }, [isLoading, isAuthenticated, router, openLogin]);

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <MainLayout>
        <FullPageLoader />
      </MainLayout>
    );
  }

  // While redirecting, show loader (prevents flash)
  if (!isAuthenticated) {
    return (
      <MainLayout>
        <FullPageLoader />
      </MainLayout>
    );
  }

  // Render sports pages for authenticated users
  return <>{children}</>;
}
