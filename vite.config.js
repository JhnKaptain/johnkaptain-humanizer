import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project site on GitHub Pages => served at /johnkaptain-humanizer/
// Use a relative base so assets work from that subpath.
export default defineConfig({
  base: "./",           // or: "/johnkaptain-humanizer/"
  plugins: [react()],
  build: {
    outDir: "docs",     // <-- GitHub Pages will serve from /docs on main
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
});
