import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B0B0C", 900: "#0F0F10", 850: "#141415", 800: "#19191B", 700: "#222225", 600: "#2E2E32", 500: "#3D3D42" },
        paper: { DEFAULT: "#FFFBF0", dim: "#D5D3CC", mute: "#8F8D88", faint: "#5E5D5A" },
        clf: { red: "#E7103D", coral: "#E6523A", sand: "#CABEAA" },
      },
      fontFamily: {
        display: ["Antonio", "Oswald", "Impact", "sans-serif"],
        mark: ["Oswald", "Antonio", "sans-serif"],
        sans: ["Archivo", "system-ui", "sans-serif"],
      },
      letterSpacing: { mark: "0.62em", wide2: "0.18em" },
      boxShadow: { card: "0 1px 0 rgba(255,251,240,0.04) inset, 0 8px 24px -16px rgba(0,0,0,0.8)" },
    },
  },
  plugins: [],
} satisfies Config;
