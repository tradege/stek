/**
 * ============================================
 * BRANDING CONTEXT - Dynamic Theme Engine
 * ============================================
 * Fetches SiteConfiguration from the backend based on the
 * current domain, and injects CSS variables + brand assets
 * dynamically into the page.
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
}

// Default brand config (fallback if no brand is resolved)
const DEFAULT_BRAND: BrandConfig = {
  id: 'default',
  brandName: 'StakePro',
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
};

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
 * Inject CSS variables into the document root based on brand config
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
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = brand.faviconUrl;
    }
  }

  // Update page title
  if (brand.brandName) {
    document.title = `${brand.brandName} - Crypto Casino`;
  }
}

interface BrandingProviderProps {
  children: ReactNode;
}

export function BrandingProvider({ children }: BrandingProviderProps) {
  const [branding, setBranding] = useState<BrandConfig>(DEFAULT_BRAND);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranding = async () => {
    try {
      setIsLoading(true);
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
          setBranding(data);
          injectCSSVariables(data);
        } else {
          // No brand found for this domain, use defaults
          injectCSSVariables(DEFAULT_BRAND);
        }
      } else {
        // API error, use defaults
        injectCSSVariables(DEFAULT_BRAND);
      }
    } catch (err) {
      console.warn('Failed to fetch branding config, using defaults:', err);
      setError('Failed to load brand configuration');
      injectCSSVariables(DEFAULT_BRAND);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
