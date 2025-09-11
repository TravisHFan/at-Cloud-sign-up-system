// Using the unified API: spread recommended first so parser + plugin are active.
const tseslint = require("typescript-eslint");

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "coverage/", "*.js"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "prefer-const": "error",
      "no-console": "off",
      "no-debugger": "error",
    },
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.eslint.json",
      },
      globals: { vi: "readonly" },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "off",
      "no-debugger": "off",
      "no-empty": "warn",
      "no-var": "off",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/no-var-requires": "off",
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
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.eslint.json",
      },
      globals: { vi: "readonly" },
    },
    rules: {
      "no-restricted-syntax": [
        "warn",
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
          selector:
            "CallExpression[callee.property.name='send'][arguments.0.callee.object.name='JSON'][arguments.0.callee.property.name='stringify']",
          message:
            "In isolated route tests, prefer res.json(...) instead of res.send(JSON.stringify(...)).",
        },
      ],
    },
  }
);
