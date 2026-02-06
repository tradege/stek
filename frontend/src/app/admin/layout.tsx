'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'))) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f212e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1475e1]"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return null;
  }

  const adminMenuItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/admin/users', label: 'Users', icon: 'Users' },
    { href: '/admin/finance', label: 'Finance', icon: 'DollarSign' },
    { href: '/admin/transactions', label: 'Transactions', icon: 'CreditCard' },
    { href: '/admin/games', label: 'Game Control', icon: 'Gamepad2' },
    { href: '/admin/settings', label: 'Settings', icon: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#0f212e]">
      <Sidebar menuItems={adminMenuItems} title="Admin Panel" />
      <main className="lg:ml-64 p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}
