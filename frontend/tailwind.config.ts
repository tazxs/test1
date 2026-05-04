import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Colors ──────────────────────────────────────────────────────────
      colors: {
        navy: '#060C1A',
        'navy-2': '#0D1526',
        'navy-3': '#131F35',
        'navy-4': '#1A2A47',
        green: '#00E87A',
        'green-dim': '#00B85F',
        amber: '#FFB800',
        red: '#FF4D4D',
        white: '#F0F4FF',
        'white-dim': 'rgba(240,244,255,0.6)',
        'white-ghost': 'rgba(240,244,255,0.08)',
        border: 'rgba(240,244,255,0.1)',
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },

      // ── Spacing scale (only the spec values) ────────────────────────────
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '15': '60px',
        '20': '80px',
        '25': '100px',
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        sm: '8px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '14px',
        '2xl': '16px',
        '3xl': '20px',
      },

      // ── Box shadows ───────────────────────────────────────────────────────
      boxShadow: {
        card: '0 40px 80px rgba(0,0,0,0.5)',
        glow: '0 0 12px rgba(0,232,122,0.3)',
        'glow-strong': '0 0 20px rgba(0,232,122,0.4)',
        'glow-logo': '0 0 8px rgba(0,232,122,0.5)',
      },

      // ── Backdrop blur ─────────────────────────────────────────────────────
      backdropBlur: {
        navbar: '20px',
      },

      // ── Transition ────────────────────────────────────────────────────────
      transitionDuration: {
        hover: '200ms',
        lift: '250ms',
        fade: '150ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease',
      },

      // ── Max-width ─────────────────────────────────────────────────────────
      maxWidth: {
        container: '1280px',
        wide: '1440px',
        narrow: '720px',
        content: '560px',
      },

      // ── Animation ─────────────────────────────────────────────────────────
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        skeleton: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pulse: 'pulse 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease forwards',
        'fade-in': 'fade-in 0.3s ease forwards',
        skeleton: 'skeleton 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    // Safe area inset utilities for iOS notch/home-bar
    plugin(({ addUtilities }) => {
      addUtilities({
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top, 0px)',
        },
        // Dynamic viewport height — fixes mobile browser address-bar layout bugs
        '.min-h-dvh': {
          minHeight: ['100vh', '100dvh'],
        },
        '.h-dvh': {
          height: ['100vh', '100dvh'],
        },
      })
    }),
  ],
}

export default config
