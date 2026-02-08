'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Menu } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile - same logic as MainLayout.tsx
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_MASTER'))) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-primary mx-auto mb-4"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_MASTER')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-primary">
      {/* Admin Sidebar - with mobile support */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />

      {/* Main Content Area - same offset as MainLayout */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Admin Header - matches casino Header position */}
        <header
          data-testid="admin-header"
          className="sticky top-0 z-30 bg-bg-card/80 backdrop-blur-xl border-b border-white/10"
        >
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            {/* Left: Mobile menu button */}
            <div className="flex items-center gap-4">
              <button
                data-testid="admin-mobile-menu"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
              <h2 className="text-lg font-bold text-white">Admin Panel</h2>
            </div>

            {/* Right: Admin info */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary hidden sm:block">
                Logged in as
              </span>
              <span className="text-sm font-medium text-accent-primary">
                {user.username}
              </span>
              <span className="px-2 py-0.5 text-[10px] bg-accent-primary/20 text-accent-primary rounded-full font-semibold">
                {user.role}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation - same pattern as MainLayout */}
      {isMobile && (
        <nav
          data-testid="admin-bottom-nav"
          className="fixed bottom-0 left-0 right-0 bg-bg-card border-t border-white/10 z-30 lg:hidden safe-area-bottom"
        >
          <div className="flex items-center justify-around py-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              data-testid="admin-mobile-sidebar-open"
              className="flex flex-col items-center gap-1 p-2 text-text-secondary hover:text-accent-primary transition-colors"
            >
              <Menu className="w-6 h-6" />
              <span className="text-xs">Menu</span>
            </button>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="flex flex-col items-center gap-1 p-2 text-accent-primary"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs">Dashboard</span>
            </button>
            <button
              onClick={() => router.push('/admin/users')}
              className="flex flex-col items-center gap-1 p-2 text-text-secondary hover:text-accent-primary transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-xs">Users</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="flex flex-col items-center gap-1 p-2 text-text-secondary hover:text-accent-primary transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-xs">Casino</span>
            </button>
          </div>
        </nav>
      )}

      {/* Add padding for mobile bottom nav */}
      {isMobile && <div className="h-16" />}
    </div>
  );
}
