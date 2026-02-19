'use client';

import Link from 'next/link';
import { useBranding } from '@/contexts/BrandingContext';

export default function NotFound() {
  const { branding } = useBranding();
  const brandName = branding.brandName || 'Casino';

  return (
    <div className="min-h-screen bg-bg-accent-primary flex items-center justify-center p-4">
      <div className="bg-bg-card border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <h2 className="text-xl font-semibold text-white mb-2">Page Not Found</h2>
        <p className="text-gray-400 mb-6 text-sm">
          The page you are looking for does not exist on {brandName}.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gradient-to-r from-primary to-blue-500 text-white rounded-lg hover:from-primary hover:to-blue-400 font-semibold transition-all"
        >
          Back to {brandName}
        </Link>
      </div>
    </div>
  );
}
