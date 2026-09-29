/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'sans-serif'], display: ['Space Grotesk', 'sans-serif'] },
    },
  },
  plugins: [],
}
