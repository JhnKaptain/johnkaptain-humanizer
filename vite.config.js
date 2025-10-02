import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Your repo is: JhnKaptain/johnkaptain-humanizer
  // So the site is served at /johnkaptain-humanizer/
  base: "/johnkaptain-humanizer/",
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
