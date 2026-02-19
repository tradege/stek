'use client';

import Link from 'next/link';
import { useModal } from '@/contexts/ModalContext';
import { useBranding } from '@/contexts/BrandingContext';

/**
 * Footer - Professional footer with legal links, social media, and license info
 * Matches the Electric Obsidian design system
 * Uses dynamic branding from BrandingContext
 */
const Footer: React.FC = () => {
  const { branding } = useBranding();
  const { openFairness } = useModal();
  const brandName = branding.brandName || 'Casino';

  return (
    <footer data-testid="footer" className="bg-bg-card border-t border-white/10 mt-auto">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center">
                <span className="text-lg font-bold text-black">{brandName.charAt(0)}</span>
              </div>
              <span className="text-lg font-bold text-white">{brandName}</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              The premier crypto casino platform. Play responsibly and enjoy our provably fair games.
            </p>
          </div>

          {/* Games */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Games</h3>
            <ul className="space-y-2">
              <li><Link href="/games/crash" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Crash</Link></li>
              <li><Link href="/games/plinko" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Plinko</Link></li>
              <li><Link href="/games/dice" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Dice</Link></li>
              <li><Link href="/games/mines" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Mines</Link></li>
              <li><Link href="/games/olympus" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Olympus</Link></li>
              <li><Link href="/sports" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Sports</Link></li>
            </ul>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Platform</h3>
            <ul className="space-y-2">
              <li><Link href="/vip" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">VIP Program</Link></li>
              <li><Link href="/promotions" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Promotions</Link></li>
              <li><Link href="/affiliates" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Affiliates</Link></li>
              <li><Link href="/faq" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/responsible-gaming" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Responsible Gaming</Link></li>
              <li><button onClick={openFairness} className="text-text-secondary text-sm hover:text-accent-primary transition-colors">Provably Fair</button></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <p className="text-text-secondary text-xs">
              &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
            </p>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-3">
            {/* Discord */}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-discord"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-secondary hover:text-[#5865F2]"
              title="Discord"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
              </svg>
            </a>
            {/* Telegram */}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-telegram"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-secondary hover:text-[#0088cc]"
              title="Telegram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </a>
            {/* Twitter/X */}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-twitter"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-secondary hover:text-white"
              title="Twitter"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          {/* 18+ Badge */}
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 text-xs font-bold">
              18+
            </span>
            <span className="text-text-secondary text-xs">Play Responsibly</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
