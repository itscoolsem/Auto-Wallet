import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './styles/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2F61FF',
        primaryAccent: '#1F3CD0',
        surface: '#0F121C',
        surfaceAlt: '#151A28',
        border: '#1F2434',
        success: '#2CD9C5',
        warning: '#FFC857',
      },
      boxShadow: {
        card: '0 20px 45px -20px rgba(15, 97, 255, 0.45)',
      },
      backgroundImage: {
        'grid-overlay': 'radial-gradient(circle at center, rgba(47,97,255,0.25) 0, rgba(15,18,28,0.0) 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
