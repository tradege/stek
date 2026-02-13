'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Menu } from 'lucide-react';

// Role badge configuration for admin panel header
const roleBadgeConfig: Record<string, { text: string; color: string; panelName: string }> = {
  ADMIN: { text: 'ADMIN', color: 'bg-red-500/20 text-red-400', panelName: 'Admin Panel' },
  SUPER_MASTER: { text: 'SUPER', color: 'bg-purple-500/20 text-purple-400', panelName: 'Admin Panel' },
  MASTER: { text: 'MASTER', color: 'bg-orange-500/20 text-orange-400', panelName: 'Master Panel' },
  AGENT: { text: 'AGENT', color: 'bg-blue-500/20 text-blue-400', panelName: 'Agent Panel' },
};

// Allowed roles for admin area
const ALLOWED_ROLES = ['ADMIN', 'SUPER_MASTER', 'MASTER', 'AGENT'];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
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

  // Auth guard - redirect non-management roles
  useEffect(() => {
    if (!isLoading && (!user || !ALLOWED_ROLES.includes(user.role))) {
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

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return null;
  }

  const roleConfig = roleBadgeConfig[user.role] || roleBadgeConfig.ADMIN;

  return (
    <div className="min-h-screen bg-bg-main text-text-accent-primary">
      {/* Admin Sidebar - with mobile support */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />

      {/* Main Content Area */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Admin Header */}
        <header
          data-testid="admin-header"
          className="sticky top-0 z-30 bg-bg-card/80 backdrop-blur-xl border-b border-white/10"
        >
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            {/* Left: Mobile menu button + Panel name */}
            <div className="flex items-center gap-4">
              <button
                data-testid="admin-mobile-menu"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
              <h2 className="text-lg font-bold text-white">{roleConfig.panelName}</h2>
            </div>

            {/* Right: User info with role badge + Back to Casino */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Casino
              </button>
              <span className="text-xs text-text-secondary hidden sm:block">|</span>
              <span className="text-sm font-medium text-accent-primary">
                {user.username}
              </span>
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${roleConfig.color}`}>
                {roleConfig.text}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>


    </div>
  );
}
