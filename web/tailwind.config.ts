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
          base:     "#06080F",
          surface:  "#0C1220",
          elevated: "#111A2E",
          overlay:  "#0F1626",
        },
        border: {
          DEFAULT: "#1A2540",
          subtle:  "#0F1829",
          accent:  "#1E3A6B",
        },
        primary: {
          DEFAULT: "#1E6FDB",
          hover:   "#1A5FC4",
          light:   "#4B9EF5",
          dim:     "rgba(30,111,219,0.15)",
        },
        cyan: {
          brand: "#06C8FF",
          dim:   "#0494BE",
          glow:  "rgba(6,200,255,0.15)",
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
          primary:   "#DCE8F5",
          secondary: "#7A9EC4",
          muted:     "#3E5C7A",
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
      },
      keyframes: {
        fadeIn:    { from: { opacity: "0" }, to: { opacity: "1" } },
        slideLeft: { from: { transform: "translateX(-8px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        glow: {
          from: { boxShadow: "0 0 4px rgba(30,111,219,0.3)" },
          to:   { boxShadow: "0 0 16px rgba(30,111,219,0.6)" },
        },
      },
      backdropBlur: { xs: "2px" },
      boxShadow: {
        card:    "0 2px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        glow:    "0 0 20px rgba(30,111,219,0.25)",
        "glow-cyan": "0 0 20px rgba(6,200,255,0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
