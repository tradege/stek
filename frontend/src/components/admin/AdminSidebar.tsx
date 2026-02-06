'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  CreditCard,
  Gamepad2,
  Settings,
  ArrowLeft,
  Shield,
  TrendingUp,
  Activity
} from 'lucide-react';

const menuItems = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin/dashboard',
    description: 'Overview & Analytics'
  },
  {
    id: 'users',
    title: 'Users',
    icon: Users,
    href: '/admin/users',
    description: 'User Management'
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: DollarSign,
    href: '/admin/finance',
    description: 'GGR & Revenue'
  },
  {
    id: 'transactions',
    title: 'Transactions',
    icon: CreditCard,
    href: '/admin/transactions',
    description: 'Deposits & Withdrawals'
  },
  {
    id: 'games',
    title: 'Game Control',
    icon: Gamepad2,
    href: '/admin/games',
    description: 'RTP & House Edge'
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    href: '/admin/settings',
    description: 'Site Configuration'
  }
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-[#1a2c38] border-r border-[#2f4553] flex flex-col">
      {/* Logo Section - Same as home page */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1475e1] to-[#0066cc] rounded-lg flex items-center justify-center shadow-lg shadow-[#1475e1]/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">StakePro</h2>
            <p className="text-xs text-[#b1bad3]">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="p-4 border-b border-white/10">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0f212e] p-3 rounded-lg border border-[#2f4553]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#00e701]" />
              <span className="text-xs text-[#b1bad3]">Revenue</span>
            </div>
            <p className="text-sm font-bold text-white">$0</p>
          </div>
          <div className="bg-[#0f212e] p-3 rounded-lg border border-[#2f4553]">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-[#1475e1]" />
              <span className="text-xs text-[#b1bad3]">Active</span>
            </div>
            <p className="text-sm font-bold text-white">0</p>
          </div>
        </div>
      </div>

      {/* Navigation Section - Same style as home page */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Section Header */}
        <div className="px-3 mb-2">
          <span className="text-xs font-semibold text-[#b1bad3] uppercase tracking-wider">
            Admin Menu
          </span>
        </div>

        {/* Menu Items */}
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                ${isActive
                  ? 'bg-[#1475e1] text-white shadow-lg shadow-[#1475e1]/20'
                  : 'text-[#b1bad3] hover:text-white hover:bg-white/5'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <div className="flex-1">
                <p className="font-medium text-sm">{item.title}</p>
                <p className={`text-xs ${isActive ? 'text-white/70' : 'text-[#b1bad3]/70'}`}>
                  {item.description}
                </p>
              </div>
              {isActive && (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Back to Casino Button */}
      <div className="p-4 border-t border-white/10">
        <Link
          href="/"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[#b1bad3] hover:text-white hover:bg-white/5 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Casino</span>
        </Link>
      </div>
    </aside>
  );
}
