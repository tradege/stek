'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import SuperAdminSidebar from '@/components/admin/SuperAdminSidebar';
import { Menu } from 'lucide-react';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  // Auth guard - only ADMIN can access Super Admin
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-primary">
      <SuperAdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />

      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-bg-card/80 backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
              >
                <Menu className="w-6 h-6 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">Super Admin Console</h1>
                <p className="text-xs text-text-secondary">White Label Management</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">{user.username}</span>
              <span className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded-full font-semibold">
                SUPER ADMIN
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
