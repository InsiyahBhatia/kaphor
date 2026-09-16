/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F2F0EA',
        ivory: '#F2F0EA',
        'figma-bg-center': '#252725',
        'figma-bg-mid': '#101211',
        'figma-bg-outer': '#050606',
        'figma-border': '#343633',
        'figma-card': '#0B0D0C',
        'figma-dossier': '#0C0E0D',
        'figma-muted': '#92928D',
        'figma-dim': '#777A75',
        crimson: '#A82222',
        gold: '#C95F12',
        emerald: {
          400: '#34D399',
          500: '#10B981',
        }
      },
      fontFamily: {
        serif: ['Georgia', '"Playfair Display"', 'serif'],
        sans: ['Inter', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        bebas: ['"Bebas Neue"', 'sans-serif'],
      },
      boxShadow: {
        'figma': '0 20px 40px rgba(0,0,0,0.8)',
      }
    },
  },
  plugins: [],
}
