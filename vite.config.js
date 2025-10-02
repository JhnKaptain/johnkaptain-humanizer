// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/johnkaptain-humanizer/",   // <-- repo name here
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
  server: { port: 5173, open: true },
});
