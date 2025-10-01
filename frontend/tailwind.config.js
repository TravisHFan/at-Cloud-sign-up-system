/** @type {import('tailwindcss').Config} */ //这是一行 JSDoc 注释，用于告诉编辑器“接下来的默认导出对象，应当符合 tailwindcss.Config 类型”。带来 IDE 智能提示、自动补全、类型校验，避免配置出错。
export default {
  content: [
    //定义 Tailwind 应扫描的文件路径，通过 glob 语法指定
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", //./src/ 下所有 .js, .ts, .jsx, .tsx 文件
    //Tailwind 只会为这些文件中使用的类生成对应 CSS，从而减少最终 CSS 的体积，避免生成冗余样式
  ],
  theme: {
    //theme 区块用于自定义设计系统，包括颜色、字体、间距、边框等
    extend: {
      fontFamily: {
        display: [
          '"Noto Sans"',
          "Inter",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
      },
    }, //extend 表示在保留默认主题的基础上新增或扩展配置（绝不会覆盖默认值）；未写的属性仍会使用默认主题
  },
  plugins: [], //用于引入 Tailwind 插件，如 @tailwindcss/forms、typography 等，也可以定义自定义插件
};
