// Flat ESLint config for backend (ESLint v9+)
// Kept in sync with .eslintrc.js so both ESLint v8 and v9 work.
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ["dist/", "node_modules/", "coverage/", "*.js"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
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
  // Test-specific relaxations and env
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.eslint.json",
      },
      globals: {
        vi: "readonly",
      },
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
  // Route-test-specific constraints (mirrors .eslintrc.js overrides)
  {
    files: [
      "tests/**/routes/**/*.test.ts",
      "tests/**/routes/**/*.test.tsx",
      "tests/unit/routes/**/*.test.ts",
      "tests/unit/routes/**/*.test.tsx",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.eslint.json",
      },
      globals: {
        vi: "readonly",
      },
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
  },
];
