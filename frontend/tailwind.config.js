/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0d0d0e",
        panel: "#161618",
        panel2: "#1d1d20",
        raise: "#242428",
        line: "#2a2a2e",
        line2: "#35353b",
        ink: "#ffffff",
        ink2: "#b6b9c0",
        muted: "#74777f",
        gold: "#f5c518",
        goldInk: "#0d0d0e",
        green: "#3ddc84",
        red: "#ff5c5c",
        blue: "#5b9dff",
      },
      fontFamily: {
        disp: ["Oswald", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: { lg: "12px", xl: "14px" },
    },
  },
  plugins: [],
}
