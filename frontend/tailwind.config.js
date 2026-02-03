/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ============================================
      // ELECTRIC OBSIDIAN COLOR PALETTE
      // ============================================
      colors: {
        // Background Colors
        'main': '#0A0E17',           // Deep obsidian black - main background
        'card': '#131B2C',           // Dark charcoal with blue tint - panels/cards
        'card-hover': '#1A2438',     // Slightly lighter for hover states
        'card-border': '#1E293B',    // Subtle border color
        
        // Accent Colors
        'accent': {
          'primary': '#00F0FF',      // Electric Cyan - main brand color
          'secondary': '#00C8D4',    // Slightly darker cyan for secondary actions
          'muted': 'rgba(0, 240, 255, 0.1)',  // Muted cyan for backgrounds
        },
        'danger': {
          'primary': '#FF385C',      // Sharp crimson red - crashes/losses
          'secondary': '#E31C5F',    // Darker red for hover
          'muted': 'rgba(255, 56, 92, 0.1)',  // Muted red for backgrounds
        },
        'success': {
          'primary': '#00D46E',      // Bright green - wins/profits
          'secondary': '#00B85C',    // Darker green for hover
          'muted': 'rgba(0, 212, 110, 0.1)', // Muted green for backgrounds
        },
        'warning': {
          'primary': '#FFB800',      // Amber - warnings
          'secondary': '#E5A600',    // Darker amber for hover
          'muted': 'rgba(255, 184, 0, 0.1)', // Muted amber for backgrounds
        },
        
        // Text Colors
        'text': {
          'primary': '#FFFFFF',      // Pure white - main text
          'secondary': '#94A3B8',    // Cool grey - secondary text
          'tertiary': '#64748B',     // Darker grey - disabled/placeholder
          'inverse': '#0A0E17',      // Dark text on light backgrounds
        },
        
        // Crypto Colors (for wallet display)
        'crypto': {
          'btc': '#F7931A',          // Bitcoin orange
          'eth': '#627EEA',          // Ethereum purple
          'usdt': '#26A17B',         // Tether green
          'sol': '#9945FF',          // Solana purple
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
      
      // ============================================
      // GLOW EFFECTS (Box Shadows)
      // ============================================
      boxShadow: {
        // Cyan Glows
        'glow-cyan-sm': '0 0 10px rgba(0, 240, 255, 0.2)',
        'glow-cyan': '0 0 15px rgba(0, 240, 255, 0.3)',
        'glow-cyan-lg': '0 0 25px rgba(0, 240, 255, 0.4)',
        'glow-cyan-xl': '0 0 40px rgba(0, 240, 255, 0.5)',
        
        // Red Glows (for crashes)
        'glow-red-sm': '0 0 10px rgba(255, 56, 92, 0.2)',
        'glow-red': '0 0 15px rgba(255, 56, 92, 0.3)',
        'glow-red-lg': '0 0 25px rgba(255, 56, 92, 0.4)',
        
        // Green Glows (for wins)
        'glow-green-sm': '0 0 10px rgba(0, 212, 110, 0.2)',
        'glow-green': '0 0 15px rgba(0, 212, 110, 0.3)',
        'glow-green-lg': '0 0 25px rgba(0, 212, 110, 0.4)',
        
        // Card shadows
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      },
      
      // ============================================
      // TYPOGRAPHY
      // ============================================
      fontFamily: {
        'sans': ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'multiplier-sm': ['1.5rem', { lineHeight: '1', fontWeight: '700' }],
        'multiplier': ['2.5rem', { lineHeight: '1', fontWeight: '700' }],
        'multiplier-lg': ['4rem', { lineHeight: '1', fontWeight: '800' }],
        'multiplier-xl': ['6rem', { lineHeight: '1', fontWeight: '900' }],
      },
      
      // ============================================
      // BORDER RADIUS (Sharper edges)
      // ============================================
      borderRadius: {
        'card': '0.5rem',    // 8px - main cards
        'button': '0.375rem', // 6px - buttons
        'input': '0.375rem',  // 6px - inputs
        'badge': '0.25rem',   // 4px - small badges
      },
      
      // ============================================
      // ANIMATIONS
      // ============================================
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'crash-shake': 'crash-shake 0.5s ease-in-out',
        'multiplier-rise': 'multiplier-rise 0.1s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 240, 255, 0.5)' },
        },
        'crash-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        'multiplier-rise': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      
      // ============================================
      // SPACING & SIZING
      // ============================================
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      // ============================================
      // Z-INDEX
      // ============================================
      zIndex: {
        'modal': '100',
        'dropdown': '50',
        'header': '40',
        'sidebar': '30',
      },
      
      // ============================================
      // BACKDROP BLUR
      // ============================================
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [
    // Custom plugin for tabular-nums utility
    function({ addUtilities }) {
      addUtilities({
        '.tabular-nums': {
          'font-variant-numeric': 'tabular-nums',
        },
        '.slashed-zero': {
          'font-variant-numeric': 'slashed-zero',
        },
        '.text-glow-cyan': {
          'text-shadow': '0 0 10px rgba(0, 240, 255, 0.5)',
        },
        '.text-glow-red': {
          'text-shadow': '0 0 10px rgba(255, 56, 92, 0.5)',
        },
        '.text-glow-green': {
          'text-shadow': '0 0 10px rgba(0, 212, 110, 0.5)',
        },
      });
    },
  ],
};
