/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#020817',
          900: '#0A0F1E',
          800: '#0D1527',
          700: '#111B35',
          600: '#162040',
          500: '#1A2744',
          400: '#1E2E52',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.15)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.15)',
        'card': '0 1px 3px rgba(0,0,0,0.4)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
