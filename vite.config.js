import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 独自ドメイン(nexua.tech)とGitHub Pages(/meishi/)の両方で動くよう相対パス配信
export default defineConfig({
  base: "./",
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
