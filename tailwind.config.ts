import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        "lspu-blue": "#1E3A8A",
        "lspu-yellow": "#FACC15",
        gco: {
          primary: "#1E3A8A",
          secondary: "#0f172a",
          accent: "#FACC15",
          light: "#f8fafc",
        },
      },
    },
  },
  plugins: [],
};
export default config;
