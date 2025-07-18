//这个配置文件的作用是告诉 Vite：本项目使用 React，我希望在开发过程中使用 JSX 与快速刷新。它是 React 项目中非常基础和推荐的配置方式。

/// <reference types="vitest" />
import { defineConfig } from "vite"; //defineConfig 是 Vite 提供的一个辅助函数，用于配置文件 vite.config.js 或 .ts。它带有 TypeScript 智能提示（IntelliSense）功能，也会在编辑器中提供参数校验和补全支持
import react from "@vitejs/plugin-react"; //这是用于支持 React 专属功能 的官方插件：包括 JSX 编译、自动 JSX runtime，以及开发环境下的 Fast Refresh（快速热更新），能让你在保存代码时保留组件状态并即时预览变化

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
