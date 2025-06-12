// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // ⬇︎ exceljs → 브라우저 번들로 강제 매핑
      exceljs: "exceljs/dist/exceljs.bare.js",   // 또는 exceljs.browser.js
    },
  },
  define: { global: "window" },   // global → window 매핑
});
