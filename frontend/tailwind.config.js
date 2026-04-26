/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['JetBrains Mono', 'monospace'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        void: '#06060a',
        obsidian: '#0f0f1a',
        'obsidian-light': '#13131f',
        accent: {
          violet: '#7c3aed',
          cyan: '#00d4ff',
          amber: '#ffaa00',
          green: '#00ff88',
          red: '#ff3355',
        },
        text: {
          primary: '#e8eaf0',
          secondary: '#8890a8',
          muted: '#4a5068',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-ring': 'pingRing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'shimmer-fast': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pingRing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '-200% 50%' }
        }
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, #7c3aed 0%, #00d4ff 50%, #7c3aed 100%)',
      }
    },
  },
  plugins: [],
};
