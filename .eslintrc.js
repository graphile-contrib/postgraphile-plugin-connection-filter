module.exports = {
  root: true,
  parser: "@babel/eslint-parser",
  parserOptions: {
    sourceType: "module",
  },
  env: {
    jest: true,
    node: true,
    es6: true,
    "jest/globals": true,
  },
  plugins: [
    "@typescript-eslint",
    "jest",
    //"tsdoc",
    //"simple-import-sort",
    //"import",
    "graphile-export",
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    // "plugin:import/errors",
    // "plugin:import/typescript",
    "plugin:graphile-export/recommended",
    "plugin:jest/recommended",
    "prettier",
  ],
  rules: {
    "jest/expect-expect": ["off"],
    "no-fallthrough": ["error", { allowEmptyCase: true }],
    "@typescript-eslint/no-var-requires": ["off"],
    "@typescript-eslint/no-explicit-any": ["off"],
    // We need this for our `GraphileBuild`/`GraphileConfig`/etc namespaces
    "@typescript-eslint/no-namespace": ["off"],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        args: "after-used",
        ignoreRestSiblings: true,
      },
    ],
  },
  overrides: [
    // Rules for TypeScript only
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
    },
  ],
};
