/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        risk: {
          low: '#00cc00',
          mid: '#ff8c00',
          high: '#ff4d4d',
        },
      },
    },
  },
  plugins: [],
}
