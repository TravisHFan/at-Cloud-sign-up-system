module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  root: true,
  env: {
    node: true,
    es6: true,
  },
  rules: {
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    // Treat unused vars as warnings to avoid blocking CI while we incrementally clean up
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    // Use core rule; the plugin variant was removed in newer versions
    "prefer-const": "error",
    // Allow console logs for server-side diagnostics; switch to a logger gradually
    "no-console": "off",
    "no-debugger": "error",
  },
  ignorePatterns: ["dist/", "node_modules/", "coverage/", "*.js"],
};
