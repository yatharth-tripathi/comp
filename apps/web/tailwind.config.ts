import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        /* shadcn compatibility — points at brand via globals.css */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* brand — use these on new surfaces */
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          raised: "rgb(var(--ink-raised) / <alpha-value>)",
          deep: "rgb(var(--ink-deep) / <alpha-value>)",
          line: "rgb(var(--ink-line) / <alpha-value>)",
        },
        parchment: {
          DEFAULT: "rgb(var(--parchment) / <alpha-value>)",
          2: "rgb(var(--parchment-2) / <alpha-value>)",
          line: "rgb(var(--parchment-line) / <alpha-value>)",
        },
        saffron: {
          DEFAULT: "rgb(var(--saffron) / <alpha-value>)",
          bright: "rgb(var(--saffron-bright) / <alpha-value>)",
          mute: "rgb(var(--saffron-mute) / <alpha-value>)",
        },
        signal: {
          DEFAULT: "rgb(var(--signal) / <alpha-value>)",
          mute: "rgb(var(--signal-mute) / <alpha-value>)",
        },
        ember: "rgb(var(--ember) / <alpha-value>)",
        fog: {
          DEFAULT: "rgb(var(--fog) / <alpha-value>)",
          dim: "rgb(var(--fog-dim) / <alpha-value>)",
        },
        "mute-cream": "rgb(var(--mute-cream) / <alpha-value>)",
      },

      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },

      fontSize: {
        "display-xl": ["clamp(3.5rem, 8vw, 5rem)", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.75rem, 6vw, 3.75rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(2.25rem, 4.5vw, 2.75rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "heading-lg": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "heading-md": ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.005em" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.55" }],
        label: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.18em" }],
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 1px)",
        sm: "calc(var(--radius) - 2px)",
      },

      keyframes: {
        "rise-in": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slow-drift": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slow-drift": "slow-drift 8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
