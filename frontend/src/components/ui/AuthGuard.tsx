'use client';
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useModal } from '@/contexts/ModalContext';
import { useRouter } from 'next/navigation';
import FullPageLoader from './FullPageLoader';

interface AuthGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export default function AuthGuard({ children, fallbackPath = '/' }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { openLogin } = useModal();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(fallbackPath);
      openLogin();
    }
  }, [isLoading, isAuthenticated, router, fallbackPath, openLogin]);

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return <FullPageLoader />;
  }

  return <>{children}</>;
}
