/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          400: "#60A5FA",
          500: "#3D7CF7",
          600: "#2563EB",
          purple: "#8B5CF6",
        },
        navy: {
          900: "#080C14",
          800: "#0D1424",
          700: "#131C32",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(61, 124, 247, 0.38)",
        "glow-sm": "0 0 14px rgba(61, 124, 247, 0.25)",
      },
      animation: {
        "spin-fast": "spin 0.7s linear infinite",
      },
    },
  },
  plugins: [],
};
