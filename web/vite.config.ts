/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("monaco-editor") || id.includes("monaco-yaml")) return "monaco";
          if (id.includes("@xterm")) return "xterm";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8760",
        changeOrigin: true,
      },
      "/healthz": {
        target: "http://127.0.0.1:8760",
        changeOrigin: true,
      },
      "/artifacts": {
        target: "http://127.0.0.1:8760",
        changeOrigin: true,
      },
    },
  },
});
