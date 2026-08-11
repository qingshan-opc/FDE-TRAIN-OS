/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiPort = process.env.FDE_API_PORT || "8760";
const devPort = Number(process.env.FDE_DEV_PORT || "5173");
const apiTarget = (process.env.FDE_INTERNAL_BASE || `http://127.0.0.1:${apiPort}`).replace(/\/$/, "");

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
    host: "0.0.0.0",
    port: devPort,
    strictPort: true,
    hmr: {
      protocol: "ws",
      clientPort: devPort,
      overlay: true,
    },
    watch: {
      usePolling: false,
      ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    },
    proxy: {
      // Long timeouts: course video streams via /api/v1/media/stream with Range.
      // Default proxy timeouts can abort mid-play and make the player flash/retry.
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        timeout: 10 * 60 * 1000,
        proxyTimeout: 10 * 60 * 1000,
      },
      "/healthz": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/artifacts": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/course-assets": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
