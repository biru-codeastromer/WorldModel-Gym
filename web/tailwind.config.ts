import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f1c2e",
        ember: "#ff7a3d",
        mint: "#66d9ba",
        cloud: "#edf2ff"
      },
      boxShadow: {
        card: "0 12px 30px rgba(15, 28, 46, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
