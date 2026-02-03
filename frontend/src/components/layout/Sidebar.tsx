import React from 'react';

// Icons (using simple SVG placeholders - replace with your icon library)
const icons = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  crash: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  dice: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  mines: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  plinko: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  wallet: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  stats: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof icons;
  href: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', href: '/' },
  { id: 'crash', label: 'Crash', icon: 'crash', href: '/games/crash', badge: 'HOT' },
  { id: 'dice', label: 'Dice', icon: 'dice', href: '/games/dice' },
  { id: 'mines', label: 'Mines', icon: 'mines', href: '/games/mines' },
  { id: 'plinko', label: 'Plinko', icon: 'plinko', href: '/games/plinko' },
];

const secondaryNavItems: NavItem[] = [
  { id: 'wallet', label: 'Wallet', icon: 'wallet', href: '/wallet' },
  { id: 'chat', label: 'Chat', icon: 'chat', href: '/chat' },
  { id: 'stats', label: 'Statistics', icon: 'stats', href: '/stats' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
];

/**
 * Sidebar - Main navigation sidebar
 * Electric Cyberpunk theme with glowing accents
 */
const Sidebar: React.FC = () => {
  const currentPath = '/games/crash'; // This would come from router in real app
  
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="p-6 border-b border-card-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-primary flex items-center justify-center shadow-glow-cyan">
            <span className="text-xl font-bold text-text-inverse">S</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">StakePro</h1>
            <p className="text-xs text-text-secondary">Crypto Casino</p>
          </div>
        </div>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        {/* Games Section */}
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Games
          </span>
        </div>
        
        <ul className="space-y-1">
          {mainNavItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
                >
                  {icons[item.icon]}
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="badge-cyan text-[10px]">{item.badge}</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
        
        {/* Divider */}
        <div className="my-4 mx-4 border-t border-card-border" />
        
        {/* Secondary Section */}
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Account
          </span>
        </div>
        
        <ul className="space-y-1">
          {secondaryNavItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
                >
                  {icons[item.icon]}
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* VIP Banner */}
      <div className="p-4 border-t border-card-border">
        <div className="card-glow p-4 text-center">
          <div className="text-2xl mb-2">👑</div>
          <p className="text-sm font-semibold text-accent-primary">VIP Program</p>
          <p className="text-xs text-text-secondary mt-1">Unlock exclusive rewards</p>
          <button className="btn-outline w-full mt-3 text-sm py-2">
            Learn More
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
