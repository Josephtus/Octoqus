/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          purple: "#b026ff",
          blue: "#00f0ff"
        }
      }
    },
  },
  plugins: [],
}
