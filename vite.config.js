import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages: https://furetomojapan.github.io/meishi/
export default defineConfig({
  base: "/meishi/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        welcome: "welcome.html"
      }
    }
  }
});
