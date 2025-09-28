//这个配置文件的作用是告诉 Vite：本项目使用 React，我希望在开发过程中使用 JSX 与快速刷新。它是 React 项目中非常基础和推荐的配置方式。

/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  // Build optimizations for production
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separate large dependencies
          "react-vendor": ["react", "react-dom"],
          "router-vendor": ["react-router-dom"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "yup"],
          "utils-vendor": ["socket.io-client", "xlsx"],
        },
      },
    },
    // Increase chunk size warning limit (default is 500kb)
    chunkSizeWarningLimit: 1000,
    // Use default esbuild minifier (faster than terser)
    minify: "esbuild",
  },
  // @ts-expect-error - Vitest config is handled by the types reference
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "src/vite-env.d.ts",
      ],
      include: ["src/**/*.{ts,tsx}"],
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
      "^/s/[^/]+$": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
/*
CSP Policy Explanation:
- default-src 'self': Allow resources from same origin by default
- script-src 'unsafe-eval': Allow eval() for development tools
- script-src 'unsafe-inline': Allow inline scripts for React and Vite
- connect-src ws: wss:: Allow WebSocket connections for HMR
- This is safe for development but should be removed in production
*/
