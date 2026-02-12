'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Wallet,
  BarChart3,
  Plus,
  ArrowLeft,
  Shield,
  X,
  Globe,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

const superAdminNavItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: '/super-admin/dashboard',
    badge: 'LIVE',
  },
  {
    id: 'tenants',
    label: 'Brands / Tenants',
    icon: <Building2 className="w-5 h-5" />,
    href: '/super-admin/tenants',
  },
  {
    id: 'create-tenant',
    label: 'Create Brand',
    icon: <Plus className="w-5 h-5" />,
    href: '/super-admin/tenants/create',
    badge: 'NEW',
  },
  {
    id: 'bankroll',
    label: 'Bankroll',
    icon: <Wallet className="w-5 h-5" />,
    href: '/super-admin/bankroll',
  },
  {
    id: 'reports',
    label: 'Master Reports',
    icon: <BarChart3 className="w-5 h-5" />,
    href: '/super-admin/reports',
  },
];

interface SuperAdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export default function SuperAdminSidebar({ isOpen, onClose, onOpen }: SuperAdminSidebarProps) {
  const pathname = usePathname();

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-bg-card border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">STEK Platform</h1>
                <p className="text-xs text-text-secondary">Super Admin</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Mode Badge */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex rounded-lg overflow-hidden bg-white/5">
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-gradient-to-r from-cyan-600 to-cyan-500 text-white">
                <Shield className="w-4 h-4" />
                Super Admin
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            <div className="px-4 mb-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                White Label Management
              </span>
            </div>

            <ul className="space-y-1 px-2">
              {superAdminNavItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/super-admin' && pathname?.startsWith(item.href) && item.id !== 'create-tenant');
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={handleNavClick}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                          : 'text-text-secondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {item.icon}
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                            item.badge === 'NEW'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-cyan-500/20 text-cyan-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="my-4 mx-4 border-t border-white/10" />

            {/* Quick Actions */}
            <div className="px-4 mb-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Quick Actions
              </span>
            </div>
            <ul className="space-y-1 px-2">
              <li>
                <Link
                  href="/admin/dashboard"
                  onClick={handleNavClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5 group"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="font-medium">Admin Panel</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  onClick={handleNavClick}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-text-secondary hover:text-white hover:bg-white/5 group"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="font-medium">Back to Casino</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Bottom Banner */}
          <div className="p-4 border-t border-white/10">
            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🌐</div>
              <p className="text-sm font-semibold text-cyan-400">White Label</p>
              <p className="text-xs text-text-secondary mt-1">B2B Platform Control</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
