/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "var(--font-nunito)",
          "system-ui",
          "sans-serif"
        ],
        inter: ["var(--font-inter)"],
        nunito: ["var(--font-nunito)"]
      }
    }
  },
  plugins: []
}
