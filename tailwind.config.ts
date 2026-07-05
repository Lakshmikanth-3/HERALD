import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-base':    '#070B14',
        'bg-card':    '#0D1424',
        'bg-hover':   '#141E35',
        'usdc-blue':  '#2775CA',
        'earn-mint':  '#4DFFD2',
        'ai-purple':  '#A78BFA',
        'warn-amber': '#F59E0B',
        'data-text':  '#94A3B8',
        // Shashi colors
        paper: '#FDFCF8',
        ink: '#1C1917',
        sepia: '#78350F',
        stone: '#E7E5E4',
        rust: '#9A3412',
        // Electric Lime — shadcn-style semantic tokens, ported from
        // electric-landing-page-template. hsl(var(--x) / <alpha-value>)
        // is the pattern Tailwind needs to support e.g. bg-primary/80.
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Space Grotesk', 'sans-serif'],
        body:    ['var(--font-body)',    'Inter',          'sans-serif'],
        // Shashi fonts
        sans: ['Inter', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius-shadcn)',
        md: 'calc(var(--radius-shadcn) - 2px)',
        sm: 'calc(var(--radius-shadcn) - 4px)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 1.2s ease-out forwards',
        'slide-right': 'slideInRight 0.35s ease forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
