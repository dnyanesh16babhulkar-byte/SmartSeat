// tailwind.config.ts
import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ── Typography ─────────────────────────────────────────────────────────
      // Cormorant Garamond: editorial, high-fashion, unmistakably luxury
      // DM Mono: precision — used for seat codes, prices, identifiers
      fontFamily: {
        display: ["Cormorant Garamond", ...fontFamily.serif],
        mono:    ["DM Mono",           ...fontFamily.mono],
      },

      // ── Colour Palette ─────────────────────────────────────────────────────
      colors: {
        // Surface hierarchy — OLED blacks
        void:     "#000000",
        abyss:    "#080808",
        obsidian: "#0F0F0F",
        graphite: "#1A1A1A",
        ash:      "#2A2A2A",
        cinder:   "#3D3D3D",

        // Gold — the single warm accent
        gold: {
          dim:    "#7A6025",
          muted:  "#C4922A",
          base:   "#D4A847",
          bright: "#E8C46A",
          shine:  "#F5DC9E",
          white:  "#FDF5DC",
        },

        // Silver — secondary metallic chrome
        silver: {
          deep:  "#4A4A4A",
          mid:   "#787878",
          base:  "#A8A8A8",
          light: "#D0D0D0",
          white: "#F0F0F0",
        },

        // Semantic seat states
        seat: {
          available:    "#1C2820",
          availableRing:"#2D5A3E",
          selected:     "#3D2E0A",
          selectedRing: "#D4A847",
          held:         "#1E1A2E",
          heldRing:     "#5B4FCE",
          booked:       "#0F0F0F",
          bookedText:   "#2A2A2A",
          blocked:      "#150E0E",
          blockedRing:  "#3D1515",
        },
      },

      // ── Spacing ────────────────────────────────────────────────────────────
      spacing: {
        "seat-sm": "28px",
        "seat-md": "34px",
        "seat-lg": "40px",
        "seat-gap": "6px",
      },

      borderRadius: {
        seat: "6px",
        pill: "100px",
      },

      // ── Box Shadows ────────────────────────────────────────────────────────
      boxShadow: {
        "seat-selected": "0 0 0 1.5px #D4A847, 0 0 12px 2px rgba(212,168,71,0.35)",
        "seat-held":     "0 0 0 1.5px #5B4FCE, 0 0 10px 2px rgba(91,79,206,0.3)",
        "seat-hover":    "0 0 0 1px #A8A8A8, 0 0 8px 1px rgba(168,168,168,0.2)",
        "card-sm":  "0 1px 3px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)",
        "card-md":  "0 4px 16px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.8)",
        "card-lg":  "0 20px 60px rgba(0,0,0,0.9), 0 8px 24px rgba(0,0,0,0.8)",
        "gold-glow":"0 0 20px rgba(212,168,71,0.4), 0 0 60px rgba(212,168,71,0.15)",
        "inset-dark":"inset 0 2px 8px rgba(0,0,0,0.6)",
      },

      // ── Keyframes ──────────────────────────────────────────────────────────
      keyframes: {
        "held-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 1.5px #5B4FCE, 0 0 8px 1px rgba(91,79,206,0.2)", opacity: "0.85" },
          "50%":      { boxShadow: "0 0 0 2px #7B6FDE, 0 0 18px 4px rgba(91,79,206,0.55)", opacity: "1" },
        },
        "row-reveal": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "result-slide": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "held-pulse":   "held-pulse 2.2s ease-in-out infinite",
        "row-reveal":   "row-reveal 0.4s ease-out both",
        "result-slide": "result-slide 0.2s ease-out both",
        "shimmer":      "shimmer 2s infinite linear",
        "fade-in":      "fade-in 0.3s ease-out both",
        "scale-in":     "scale-in 0.25s cubic-bezier(0.16,1,0.3,1) both",
      },

      transitionTimingFunction: {
        "seat":   "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "reveal": "cubic-bezier(0.16, 1, 0.3, 1)",
        "luxury": "cubic-bezier(0.77, 0, 0.175, 1)",
      },

      letterSpacing: {
        editorial: "0.15em",
        "wide-xl":  "0.25em",
        mono:      "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;