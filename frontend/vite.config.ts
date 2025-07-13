//这个配置文件的作用是告诉 Vite：本项目使用 React，我希望在开发过程中使用 JSX 与快速刷新。它是 React 项目中非常基础和推荐的配置方式。

import { defineConfig } from "vite"; //defineConfig 是 Vite 提供的一个辅助函数，用于配置文件 vite.config.js 或 .ts。它带有 TypeScript 智能提示（IntelliSense）功能，也会在编辑器中提供参数校验和补全支持
import react from "@vitejs/plugin-react"; //这是用于支持 React 专属功能 的官方插件：包括 JSX 编译、自动 JSX runtime，以及开发环境下的 Fast Refresh（快速热更新），能让你在保存代码时保留组件状态并即时预览变化

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Configure CSP headers for development to allow Socket.IO and React DevTools
    headers: {
      // Allow eval and inline scripts in development for Socket.IO and hot reload
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self'; object-src 'none'; child-src 'none';",
    },
  },
});
/* 以对象形式输出 Vite 的配置，其中：
plugins 是一个 插件数组，Vite 会在开发和构建流程中依次应用这些插件 
react() 调用了 React 插件的默认导出，即启用上述功能，确保你的项目能正确识别 .jsx / .tsx 文件并体验热重载。 

CSP Policy Explanation:
- default-src 'self': Allow resources from same origin by default
- script-src 'unsafe-eval': Allow eval() for Socket.IO and development tools
- script-src 'unsafe-inline': Allow inline scripts for React and Vite
- connect-src ws: wss:: Allow WebSocket connections for Socket.IO and HMR
- This is safe for development but should be removed in production
*/
