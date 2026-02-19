/**
 * ============================================
 * BRANDING CONTEXT - Dynamic Theme Engine
 * ============================================
 * Receives initial SiteConfiguration from the Server Component
 * (layout.tsx) via the `initialConfig` prop, so the first paint
 * already has the correct brand.  Then silently refreshes from
 * the API on the client to keep the cache warm.
 *
 * Usage:
 *   const { branding, isLoading } = useBranding();
 *   // branding.brandName, branding.logoUrl, etc.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Brand configuration type matching the backend SiteConfiguration
export interface BrandConfig {
  id: string;
  brandName: string;
  domain: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  dangerColor: string;
  backgroundColor: string;
  cardColor: string;
  heroImageUrl: string | null;
  backgroundImageUrl: string | null;
  loginBgUrl: string | null;
  gameAssets: Record<string, { bg?: string; icon?: string }> | null;
  locale: string;
  supportEmail: string;
}

// Default brand config (fallback if no brand is resolved)
const DEFAULT_BRAND: BrandConfig = {
  id: 'default',
  brandName: 'Casino',
  domain: 'localhost',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#00F0FF',
  secondaryColor: '#131B2C',
  accentColor: '#00D46E',
  dangerColor: '#FF385C',
  backgroundColor: '#0A0E17',
  cardColor: '#131B2C',
  heroImageUrl: null,
  backgroundImageUrl: null,
  loginBgUrl: null,
  gameAssets: null,
  locale: 'en',
  supportEmail: 'support@localhost',
};

const CACHE_KEY = 'stek_brand_cache';

/**
 * Try to load cached brand from localStorage for the current domain.
 * Returns the cached brand if found, otherwise null.
 */
function getCachedBrand(): BrandConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Only use cache if it matches the current domain
    const currentDomain = window.location.hostname;
    if (parsed && parsed.domain === currentDomain && parsed.brandName) {
      return parsed as BrandConfig;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save brand config to localStorage for instant loading next time.
 */
function cacheBrand(brand: BrandConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(brand));
  } catch {
    // Silently fail if localStorage is full or unavailable
  }
}

interface BrandingContextType {
  branding: BrandConfig;
  siteId: string;
  isLoading: boolean;
  error: string | null;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRAND,
  siteId: 'default',
  isLoading: true,
  error: null,
  refreshBranding: async () => {},
});

/**
 * Inject CSS variables into the document root based on brand config.
 * Called on the client after hydration to keep DOM in sync.
 */
function injectCSSVariables(brand: BrandConfig) {
  const root = document.documentElement;

  // Primary brand colors
  root.style.setProperty('--primary-color', brand.primaryColor);
  root.style.setProperty('--secondary-color', brand.secondaryColor);
  root.style.setProperty('--accent-color', brand.accentColor);
  root.style.setProperty('--danger-color', brand.dangerColor);
  root.style.setProperty('--bg-color', brand.backgroundColor);
  root.style.setProperty('--card-color', brand.cardColor);

  // Computed variants (lighter/darker)
  root.style.setProperty('--primary-color-muted', `${brand.primaryColor}1A`); // 10% opacity
  root.style.setProperty('--danger-color-muted', `${brand.dangerColor}1A`);
  root.style.setProperty('--accent-color-muted', `${brand.accentColor}1A`);

  // Glow effects based on primary color
  root.style.setProperty('--glow-primary-sm', `0 0 10px ${brand.primaryColor}33`);
  root.style.setProperty('--glow-primary', `0 0 15px ${brand.primaryColor}4D`);
  root.style.setProperty('--glow-primary-lg', `0 0 25px ${brand.primaryColor}66`);

  // Background image
  if (brand.backgroundImageUrl) {
    root.style.setProperty('--bg-image', `url(${brand.backgroundImageUrl})`);
  }

  // Update favicon if provided
  if (brand.faviconUrl) {
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = brand.faviconUrl;
    } else {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = brand.faviconUrl;
      document.head.appendChild(favicon);
    }
  }
}

interface BrandingProviderProps {
  children: ReactNode;
  /** SSR-provided initial config from layout.tsx — eliminates FOUC */
  initialConfig?: BrandConfig;
}

export function BrandingProvider({ children, initialConfig }: BrandingProviderProps) {
  // Priority: SSR initialConfig > localStorage cache > DEFAULT_BRAND
  const cached = getCachedBrand();
  const initial = initialConfig || cached || DEFAULT_BRAND;

  const [branding, setBranding] = useState<BrandConfig>(initial);
  const [isLoading, setIsLoading] = useState(!initialConfig && !cached);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = async () => {
    try {
      if (!initialConfig && !cached) setIsLoading(true);
      setError(null);

      // Get current domain
      const currentDomain = window.location.hostname;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

      // Fetch brand config from backend
      const response = await fetch(
        `${apiBase}/api/v1/tenants/by-domain?domain=${encodeURIComponent(currentDomain)}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.id) {
          // Derive supportEmail from domain if not provided
          if (!data.supportEmail && data.domain) {
            data.supportEmail = `support@${data.domain}`;
          }
          // Store the domain we actually fetched for (for cache matching)
          data.domain = currentDomain;
          setBranding(data);
          injectCSSVariables(data);
          cacheBrand(data); // Cache for next visit
        } else {
          // No brand found — use initialConfig or defaults
          const fallback = { ...DEFAULT_BRAND, brandName: initial.brandName || 'Casino', domain: currentDomain };
          setBranding(fallback);
          injectCSSVariables(fallback);
          cacheBrand(fallback);
        }
      } else {
        // API error — if we have initial/cache, keep using it; otherwise use defaults
        if (!initialConfig && !cached) {
          injectCSSVariables(DEFAULT_BRAND);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch branding config, using defaults:', err);
      setError('Failed to load brand configuration');
      if (!initialConfig && !cached) {
        injectCSSVariables(DEFAULT_BRAND);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If we have SSR config, inject CSS immediately on hydration
    if (initialConfig) {
      injectCSSVariables(initialConfig);
      cacheBrand({ ...initialConfig, domain: window.location.hostname });
    } else if (cached) {
      injectCSSVariables(cached);
    }
    // Always fetch fresh data (updates cache silently)
    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        siteId: branding.id,
        isLoading,
        error,
        refreshBranding: fetchBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

/**
 * Hook to access branding context
 */
export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}

/**
 * Hook to get game-specific assets for the current brand
 */
export function useGameAssets(gameType: string) {
  const { branding } = useBranding();
  
  if (branding.gameAssets && branding.gameAssets[gameType]) {
    return branding.gameAssets[gameType];
  }
  
  return { bg: null, icon: null };
}

export default BrandingContext;
