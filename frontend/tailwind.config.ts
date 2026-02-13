import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/contexts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ============================================
        // ORIGINAL ELECTRIC OBSIDIAN COLOR PALETTE
        // ============================================
        // Background Colors
        'main': '#0A0E17',
        'card': {
          DEFAULT: 'var(--card-color, #131B2C)',
          'hover': '#1A2438',
          'border': '#1E293B',
        },

        // Accent Colors (original naming - used throughout all components)
        'accent': {
          'primary': 'var(--primary-color, #00F0FF)',      // Electric Cyan - main brand color
          'secondary': '#00C8D4',
          'muted': 'var(--primary-color-muted, rgba(0, 240, 255, 0.1))',
          DEFAULT: 'var(--accent-color, #00D46E)',
        },
        'danger': {
          'primary': 'var(--danger-color, #FF385C)',
          'secondary': '#E31C5F',
          'muted': 'var(--danger-color-muted, rgba(255, 56, 92, 0.1))',
          DEFAULT: 'var(--danger-color, #FF385C)',
        },
        'success': {
          'primary': '#00D46E',
          'secondary': '#00B85C',
          'muted': 'rgba(0, 212, 110, 0.1)',
        },
        'warning': {
          'primary': '#FFB800',
          'secondary': '#E5A600',
          'muted': 'rgba(255, 184, 0, 0.1)',
        },

        // Dynamic brand colors via CSS variables (aliases for white-label)
        'primary': {
          DEFAULT: 'var(--primary-color, #00F0FF)',
          muted: 'var(--primary-color-muted, rgba(0, 240, 255, 0.1))',
        },
        'secondary': {
          DEFAULT: 'var(--secondary-color, #131B2C)',
        },

        // Text Colors
        'text': {
          'primary': '#FFFFFF',
          'secondary': '#94A3B8',
          'tertiary': '#64748B',
          'inverse': '#0A0E17',
        },

        // Keep backward compatibility tokens
        'bg-main': 'var(--bg-color, #0A0E17)',
        'bg-card': 'var(--card-color, #131B2C)',
        'border-main': '#1E293B',

        // Crypto Colors
        'crypto': {
          'btc': '#F7931A',
          'eth': '#627EEA',
          'usdt': '#26A17B',
          'sol': '#9945FF',
        },

        // VIP Tier Colors
        'vip': {
          'bronze': '#CD7F32',
          'silver': '#C0C0C0',
          'gold': '#FFD700',
          'platinum': '#E5E4E2',
          'diamond': '#B9F2FF',
        },
      },
      boxShadow: {
        // Cyan Glows (original)
        'glow-cyan-sm': '0 0 10px rgba(0, 240, 255, 0.2)',
        'glow-cyan': '0 0 15px rgba(0, 240, 255, 0.3)',
        'glow-cyan-lg': '0 0 25px rgba(0, 240, 255, 0.4)',
        'glow-cyan-xl': '0 0 40px rgba(0, 240, 255, 0.5)',
        // Dynamic glows via CSS variables (for white-label)
        'glow-sm': 'var(--glow-primary-sm, 0 0 10px rgba(0, 240, 255, 0.2))',
        'glow': 'var(--glow-primary, 0 0 15px rgba(0, 240, 255, 0.3))',
        'glow-lg': 'var(--glow-primary-lg, 0 0 25px rgba(0, 240, 255, 0.4))',
        // Red Glows
        'glow-red-sm': '0 0 10px rgba(255, 56, 92, 0.2)',
        'glow-red': '0 0 15px rgba(255, 56, 92, 0.3)',
        'glow-red-lg': '0 0 25px rgba(255, 56, 92, 0.4)',
        // Green Glows
        'glow-green-sm': '0 0 10px rgba(0, 212, 110, 0.2)',
        'glow-green': '0 0 15px rgba(0, 212, 110, 0.3)',
        'glow-green-lg': '0 0 25px rgba(0, 212, 110, 0.4)',
        // Card shadows
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      },
      backgroundImage: {
        'brand-pattern': 'var(--bg-image, none)',
      },
      fontFamily: {
        'sans': ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'multiplier-sm': ['1.5rem', { lineHeight: '1', fontWeight: '700' }],
        'multiplier': ['2.5rem', { lineHeight: '1', fontWeight: '700' }],
        'multiplier-lg': ['4rem', { lineHeight: '1', fontWeight: '800' }],
        'multiplier-xl': ['6rem', { lineHeight: '1', fontWeight: '900' }],
      },
      borderRadius: {
        'card': '0.5rem',
        'button': '0.375rem',
        'input': '0.375rem',
        'badge': '0.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
