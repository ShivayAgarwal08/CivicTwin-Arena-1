/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: "#FBF9F5",         // warm ivory
          surface: "#F4F0E8",    // slightly deeper ivory
          card: "#FFFFFF",
          border: "#E5DEC9",
          charcoal: "#1F2421",
          muted: "#667085",
          forest: "#1B4332",     // restrained emerald / forest green
          emerald: "#2D6A4F",
          accent: "#2D6A4F",
          amber: "#D97706",
          coral: "#DC2626",
          blue: "#2563EB",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}

