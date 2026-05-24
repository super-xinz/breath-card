/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      },
      boxShadow: {
        glass: "0 28px 90px rgba(0, 0, 0, 0.48)",
        petal: "0 0 22px rgba(125, 211, 252, 0.22), 0 0 42px rgba(167, 139, 250, 0.16)"
      }
    }
  },
  plugins: []
};
