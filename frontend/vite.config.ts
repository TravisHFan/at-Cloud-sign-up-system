//这个配置文件的作用是告诉 Vite：本项目使用 React，我希望在开发过程中使用 JSX 与快速刷新。它是 React 项目中非常基础和推荐的配置方式。

/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { buildContentSecurityPolicy } from "./src/config/contentSecurityPolicy";

// Read version from package.json
import packageJson from "./package.json";

function chunkNameFromPath(id: string, marker: string, prefix: string) {
  const [, rest] = id.split(marker);
  const firstSegment = rest?.split("/")[0]?.replace(/\.[jt]sx?$/, "");
  return firstSegment ? `${prefix}-${firstSegment}` : prefix;
}

function isCommonJsHelper(id: string) {
  return id.includes("commonjsHelpers");
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const contentSecurityPolicy = buildContentSecurityPolicy(env.VITE_API_URL);

  return {
    plugins: [
      react(),
      {
        name: "inject-content-security-policy",
        transformIndexHtml(html) {
          return html.replace(
            "__CONTENT_SECURITY_POLICY__",
            contentSecurityPolicy,
          );
        },
      },
      visualizer({
        filename: "dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    // Inject app version as environment variable
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    // Build optimizations for production
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Keep Rollup's shared CommonJS interop helpers out of feature chunks.
            // If a helper lands in a lazy/specialized vendor chunk, the browser can
            // evaluate chunks in a cycle before React's namespace export is ready.
            if (isCommonJsHelper(id)) {
              return "vendor";
            }

            if (id.includes("node_modules")) {
              if (
                id.includes("/react/") ||
                id.includes("/react-dom/") ||
                id.includes("/react-router/") ||
                id.includes("/react-router-dom/") ||
                id.includes("/react-redux/") ||
                id.includes("/use-sync-external-store/") ||
                id.includes("scheduler")
              ) {
                return "react-vendor";
              }
              if (
                id.includes("react-hook-form") ||
                id.includes("@hookform/resolvers") ||
                id.includes("/yup/")
              ) {
                return "form-vendor";
              }
              if (id.includes("@heroicons/react")) {
                return "icons-vendor";
              }
              if (id.includes("recharts") || id.includes("d3-")) {
                return "charts-vendor";
              }
              if (
                id.includes("html2pdf.js") ||
                id.includes("html2canvas") ||
                id.includes("jspdf")
              ) {
                return "pdf-vendor";
              }
              if (id.includes("xlsx")) {
                return "spreadsheet-vendor";
              }
              if (
                id.includes("socket.io-client") ||
                id.includes("engine.io-client")
              ) {
                return "realtime-vendor";
              }
              if (id.includes("@stripe")) {
                return "payments-vendor";
              }
              return "vendor";
            }

            if (id.includes("/src/pages/")) {
              return chunkNameFromPath(id, "/src/pages/", "page");
            }
            if (id.includes("/src/components/admin/")) {
              return "admin-components";
            }
            if (id.includes("/src/components/analytics/")) {
              return "analytics-components";
            }
          },
        },
      },
      // Increase chunk size warning limit (default is 500kb)
      chunkSizeWarningLimit: 1000,
      // Use default esbuild minifier (faster than terser)
      minify: "esbuild",
    },
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
  };
});
/*
CSP Policy Explanation:
- default-src 'self': Allow resources from same origin by default
- script-src 'unsafe-eval': Allow eval() for development tools
- script-src 'unsafe-inline': Allow inline scripts for React and Vite
- connect-src ws: wss:: Allow WebSocket connections for HMR
- This is safe for development but should be removed in production
*/
