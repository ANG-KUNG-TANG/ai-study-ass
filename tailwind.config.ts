import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF6EC",
        "paper-raised": "#FFFFFF",
        ink: "#221F1A",
        "ink-soft": "#726B5C",
        "ink-faint": "#B3A98F",
        "ink-invert-soft": "#C8C2B4", // muted text on dark surfaces (e.g. continue-studying banner)
        line: "#E6DDC8",
        "line-soft": "#EFE8D6",
        yellow: { DEFAULT: "#FFCE3E", soft: "#FFF1C2", line: "#F0DFA0" },
        coral: { DEFAULT: "#E85D46", soft: "#FBE1DB" },
        sage: { DEFAULT: "#4C7A5A", soft: "#DCEBDF" },
        violet: { DEFAULT: "#6C63B0", soft: "#E7E4F5" },
        slate: { DEFAULT: "#5E7A96", soft: "#DEE9F2" },
      },
      fontFamily: {
        serif: ["var(--font-sans)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
} satisfies Config;
