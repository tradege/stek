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
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin/dashboard',
    description: 'Overview & Analytics'
  },
  {
    title: 'Users',
    icon: Users,
    href: '/admin/users',
    description: 'User Management'
  },
  {
    title: 'Finance',
    icon: DollarSign,
    href: '/admin/finance',
    description: 'GGR & Revenue'
  },
  {
    title: 'Transactions',
    icon: CreditCard,
    href: '/admin/transactions',
    description: 'Deposits & Withdrawals'
  },
  {
    title: 'Game Control',
    icon: Gamepad2,
    href: '/admin/games',
    description: 'RTP & House Edge'
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/admin/settings',
    description: 'Site Configuration'
  }
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-[#0a1a24] border-r border-[#1a2c38] flex flex-col">
      <div className="p-6 border-b border-[#1a2c38]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#0a1a24]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-yellow-400">StakePro</h2>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-[#1a2c38]">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#1a2c38] p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Revenue</span>
            </div>
            <p className="text-sm font-bold text-white">$0</p>
          </div>
          <div className="bg-[#1a2c38] p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Active</span>
            </div>
            <p className="text-sm font-bold text-white">0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${isActive
                  ? 'bg-gradient-to-r from-yellow-400/20 to-yellow-600/20 border border-yellow-400/30 text-yellow-400'
                  : 'text-gray-400 hover:bg-[#1a2c38] hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <div className="flex-1">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs opacity-70">{item.description}</p>
              </div>
              {isActive && (
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#1a2c38]">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1a2c38] hover:bg-[#2f4553] text-gray-400 hover:text-white transition-all group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Casino</span>
        </Link>
      </div>
    </aside>
  );
}
