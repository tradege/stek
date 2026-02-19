import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import '@/styles/globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

/**
 * Server-side helper: fetch SiteConfiguration from the backend
 * based on the current request's Host header.
 */
async function fetchSiteConfig(hostname: string) {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
    const res = await fetch(
      `${apiBase}/api/v1/tenants/by-domain?domain=${encodeURIComponent(hostname)}`,
      {
        cache: 'no-store', // Always fetch fresh for SSR
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (res.ok) {
      const text = await res.text();
      if (!text || text.length === 0) {
        // Empty response — no tenant found for this domain
        return null;
      }
      const data = JSON.parse(text);
      if (data && data.id) {
        // Derive supportEmail if not provided
        if (!data.supportEmail && data.domain) {
          data.supportEmail = `support@${data.domain}`;
        }
        return data;
      }
    }
  } catch (err) {
    console.error('SSR: Failed to fetch site config:', err);
  }
  // Fallback defaults
  return {
    id: 'default',
    brandName: 'Casino',
    domain: hostname,
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
    supportEmail: `support@${hostname}`,
  };
}

/**
 * Build the inline CSS string for the brand's CSS variables.
 * This is injected into the <head> at SSR time so the browser
 * paints the correct colors on the very first frame — no FOUC.
 */
function buildCSSVariables(config: Record<string, any>): string {
  const pc = config.primaryColor || '#00F0FF';
  const sc = config.secondaryColor || '#131B2C';
  const ac = config.accentColor || '#00D46E';
  const dc = config.dangerColor || '#FF385C';
  const bg = config.backgroundColor || '#0A0E17';
  const cc = config.cardColor || '#131B2C';

  return `
    :root {
      --primary-color: ${pc};
      --secondary-color: ${sc};
      --accent-color: ${ac};
      --danger-color: ${dc};
      --bg-color: ${bg};
      --card-color: ${cc};
      --primary-color-muted: ${pc}1A;
      --danger-color-muted: ${dc}1A;
      --accent-color-muted: ${ac}1A;
      --glow-primary-sm: 0 0 10px ${pc}33;
      --glow-primary: 0 0 15px ${pc}4D;
      --glow-primary-lg: 0 0 25px ${pc}66;
    }
  `;
}

/**
 * Next.js generateMetadata — runs on the server to produce
 * dynamic <title>, <meta description>, and <link rel="icon">.
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost';
  const hostname = host.split(':')[0];
  const config = await fetchSiteConfig(hostname);
  const brandName = config?.brandName || 'Casino';

  return {
    title: brandName,
    description: `${brandName} — The ultimate crypto casino experience with provably fair games`,
    keywords: ['crypto', 'casino', 'crash', 'bitcoin', 'gambling'],
    icons: config?.faviconUrl ? { icon: config.faviconUrl } : undefined,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ---- Server-side: resolve the tenant config ----
  const headersList = headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost';
  const hostname = host.split(':')[0];
  const siteConfig = await fetchSiteConfig(hostname) || {
    id: 'default',
    brandName: 'Casino',
    domain: hostname,
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
    supportEmail: `support@${hostname}`,
  };
  const cssVars = buildCSSVariables(siteConfig);

  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* SSR-injected CSS variables — eliminates FOUC */}
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body className="bg-main text-text-primary antialiased">
        <Providers initialBrandConfig={siteConfig}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
