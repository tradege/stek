'use client';

import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Extra client-side protection (Double Check)
  useEffect(() => {
    if (!isLoading && user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading Admin Panel...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}
