import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use relative paths so the site works from any subfolder (GitHub Pages-friendly)
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
});
