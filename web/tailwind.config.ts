import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     "#030A04",
          surface:  "#071209",
          elevated: "#0C1E0F",
          overlay:  "#091508",
        },
        border: {
          DEFAULT: "#1A3D20",
          subtle:  "#0F2412",
          accent:  "#1E5628",
        },
        primary: {
          DEFAULT: "#22C55E",
          hover:   "#16A34A",
          light:   "#4ADE80",
          dim:     "rgba(34,197,94,0.15)",
        },
        // lime replaces cyan as secondary accent
        cyan: {
          brand: "#A3E635",
          dim:   "#65A30D",
          glow:  "rgba(163,230,53,0.15)",
        },
        success: {
          DEFAULT: "#0DB87E",
          dim:     "#0A8C60",
          bg:      "rgba(13,184,126,0.12)",
        },
        warning: {
          DEFAULT: "#E8A020",
          dim:     "#B87C18",
          bg:      "rgba(232,160,32,0.12)",
        },
        danger: {
          DEFAULT: "#E03E3E",
          dim:     "#B82C2C",
          bg:      "rgba(224,62,62,0.12)",
        },
        text: {
          primary:   "#DCE8DC",
          secondary: "#7A9C7A",
          muted:     "#3E5A3E",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "fade-in":    "fadeIn 0.25s ease-out",
        "slide-left": "slideLeft 0.25s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "glow":       "glow 2s ease-in-out infinite alternate",
        "scan":       "scan 3s linear infinite",
      },
      keyframes: {
        fadeIn:    { from: { opacity: "0" }, to: { opacity: "1" } },
        slideLeft: { from: { transform: "translateX(-8px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        glow: {
          from: { boxShadow: "0 0 4px rgba(34,197,94,0.3)" },
          to:   { boxShadow: "0 0 16px rgba(34,197,94,0.6)" },
        },
        scan: {
          "0%":   { transform: "translateY(0%)", opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
      },
      backdropBlur: { xs: "2px" },
      boxShadow: {
        card:       "0 2px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        glow:       "0 0 20px rgba(34,197,94,0.25)",
        "glow-lime":"0 0 20px rgba(163,230,53,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
