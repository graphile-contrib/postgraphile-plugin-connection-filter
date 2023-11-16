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
    "@typescript-eslint/no-var-requires": ["off"],
  },
  overrides: [
    // Rules for TypeScript only
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
    },
  ],
};
