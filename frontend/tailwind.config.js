/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        brutalism: ["var(--font-brutalism)", "sans-serif"],
        readable: ["var(--font-readable)", "sans-serif"],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        /* Golden Ratio Official Palette (STITEK Bontang) */
        alabaster: {
          DEFAULT: "#F7F3E9",
          canvas: "#F7F3E9",
          card: "#FFFFFF",
          light: "#FFFDF9",
        },
        brass: {
          DEFAULT: "#D4AF37",
          hover: "#C4A02F",
          active: "#B39027",
          dark: "#8C6D1F",
          light: "#FAF4E1",
        },
        steel: {
          DEFAULT: "#415A77",
          light: "#E9EEF4",
          muted: "rgba(65, 90, 119, 0.15)",
        },
        sapphire: {
          DEFAULT: "#0D1B2A",
          hover: "#1B2B3E",
          active: "#070F18",
          card: "#152238",
        },
      },
      borderRadius: {
        sm: "8px",     /* Fibonacci scale */
        md: "13px",    /* Fibonacci scale */
        lg: "21px",    /* Fibonacci scale (Default Bento Card) */
        xl: "34px",    /* Fibonacci scale */
        full: "9999px"
      },
      spacing: {
        xs: "5px",     /* Fibonacci scale */
        sm: "8px",     /* Fibonacci scale */
        md: "13px",    /* Fibonacci scale */
        lg: "21px",    /* Fibonacci scale */
        xl: "34px",    /* Fibonacci scale */
        xxl: "55px"    /* Fibonacci scale */
      },
    },
  },
  plugins: [],
}
