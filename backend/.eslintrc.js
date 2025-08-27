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
  overrides: [
    {
      files: ["tests/**/*.ts", "tests/**/*.tsx"],
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
      env: {
        jest: true,
        node: true,
        es6: true,
      },
      globals: {
        vi: "readonly",
      },
      rules: {
        // In tests, allow @ts-ignore with a brief description to avoid hard failures
        // Prefer @ts-expect-error where practical, but do not fail CI on legacy patterns
        "@typescript-eslint/ban-ts-comment": "warn",
        // Do not fail tests lint on const preference or debugger usage (rare in tests anyway)
        "prefer-const": "off",
        "no-debugger": "off",
        // Relax additional rules commonly tripped in tests
        "no-empty": "warn",
        "no-var": "off",
        "@typescript-eslint/no-this-alias": "warn",
        "@typescript-eslint/no-namespace": "warn",
        // Tests frequently use require for dynamic mocking/setup
        "@typescript-eslint/no-var-requires": "off",
        // Allow legacy Function typing in tests without failing CI
        "@typescript-eslint/ban-types": "warn",
      },
    },
    {
      files: [
        "tests/**/routes/**/*.test.ts",
        "tests/**/routes/**/*.test.tsx",
        "tests/unit/routes/**/*.test.ts",
        "tests/unit/routes/**/*.test.tsx",
      ],
      parserOptions: {
        // Include tests in the TS program for ESLint to avoid parser errors
        project: "./tsconfig.eslint.json",
      },
      env: {
        // Provide common test globals (describe/it/expect) used by Vitest
        jest: true,
        node: true,
        es6: true,
      },
      globals: {
        vi: "readonly",
      },
      rules: {
        // Prefer res.json(...) for JSON responses in isolated route tests
        // Disallow manually setting JSON Content-Type headers
        "no-restricted-syntax": [
          "warn",
          // Exact common JSON content-type values; avoiding regex in selector due to esquery regex parsing issues
          {
            selector:
              "CallExpression[callee.property.name='setHeader'][arguments.0.value='Content-Type'][arguments.1.value='application/json']",
            message:
              "In isolated route tests, prefer res.json(...) for JSON responses; do not manually set Content-Type for JSON.",
          },
          {
            selector:
              "CallExpression[callee.property.name='setHeader'][arguments.0.value='Content-Type'][arguments.1.value='application/json; charset=utf-8']",
            message:
              "In isolated route tests, prefer res.json(...) for JSON responses; do not manually set Content-Type for JSON.",
          },
          {
            selector:
              "CallExpression[callee.property.name='setHeader'][arguments.0.value='Content-Type'][arguments.1.value='application/json; charset=UTF-8']",
            message:
              "In isolated route tests, prefer res.json(...) for JSON responses; do not manually set Content-Type for JSON.",
          },
          {
            // Disallow res.send(JSON.stringify(...)) in favor of res.json(...)
            selector:
              "CallExpression[callee.property.name='send'][arguments.0.callee.object.name='JSON'][arguments.0.callee.property.name='stringify']",
            message:
              "In isolated route tests, prefer res.json(...) instead of res.send(JSON.stringify(...)).",
          },
        ],
      },
    },
  ],
  ignorePatterns: ["dist/", "node_modules/", "coverage/", "*.js"],
};
