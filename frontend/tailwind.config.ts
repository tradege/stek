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
        // Dynamic brand colors via CSS variables (set by BrandingContext)
        primary: {
          DEFAULT: 'var(--primary-color, #00F0FF)',
          muted: 'var(--primary-color-muted, rgba(0, 240, 255, 0.1))',
        },
        secondary: {
          DEFAULT: 'var(--secondary-color, #131B2C)',
        },
        accent: {
          DEFAULT: 'var(--accent-color, #00D46E)',
          muted: 'var(--accent-color-muted, rgba(0, 212, 110, 0.1))',
        },
        danger: {
          DEFAULT: 'var(--danger-color, #FF385C)',
          muted: 'var(--danger-color-muted, rgba(255, 56, 92, 0.1))',
        },
        main: {
          DEFAULT: 'var(--bg-color, #0A0E17)',
        },
        card: {
          DEFAULT: 'var(--card-color, #131B2C)',
        },
        // Keep existing color tokens for backward compatibility
        'bg-main': 'var(--bg-color, #0A0E17)',
        'bg-card': 'var(--card-color, #131B2C)',
        'text-primary': '#FFFFFF',
        'text-secondary': '#8B95A5',
        'text-muted': '#4A5568',
        'border-main': '#1E293B',
      },
      boxShadow: {
        'glow-sm': 'var(--glow-primary-sm, 0 0 10px rgba(0, 240, 255, 0.2))',
        'glow': 'var(--glow-primary, 0 0 15px rgba(0, 240, 255, 0.3))',
        'glow-lg': 'var(--glow-primary-lg, 0 0 25px rgba(0, 240, 255, 0.4))',
      },
      backgroundImage: {
        'brand-pattern': 'var(--bg-image, none)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
