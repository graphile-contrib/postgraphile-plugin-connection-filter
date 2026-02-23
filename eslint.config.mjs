// @ts-check
import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import graphileExport from "eslint-plugin-graphile-export";
import jest from "eslint-plugin-jest";
import fs from "fs";
import globals from "globals";
import path from "path";
import tseslint from "typescript-eslint";

const __dirname = import.meta.dirname;

const globalIgnoresFromFile = fs
  .readFileSync(path.resolve(__dirname, ".lintignore"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    let text = line;
    text = text.startsWith("/") ? text.substring(1) : `**/${text}`;
    text = text.endsWith("/") ? text + "**" : text;
    return text;
  });

/** @type {import('@eslint/config-helpers').ConfigWithExtends} */
const config = {
  languageOptions: {
    parser: tsParser,
    sourceType: "module",
    globals: {
      jasmine: false,
      ...globals.jest,
      ...globals.node,
    },
  },

  settings: {
    "import/resolver": {
      node: true,
      typescript: true,
    },
  },

  plugins: {
    jest,
  },

  rules: {
    "jest/expect-expect": ["off"],
    "no-fallthrough": ["error", { allowEmptyCase: true }],
    "@typescript-eslint/no-var-requires": ["off"],
    "@typescript-eslint/no-explicit-any": ["off"],
    // We need this for our `GraphileBuild`/`GraphileConfig`/etc namespaces
    "@typescript-eslint/no-namespace": "off",
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
};

export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  // ...tseslint.configs.recommendedTypeChecked, // requires parserOptions.project
  graphileExport.configs.recommended,
  jest.configs["flat/recommended"],
  prettier, // not a plugin, just a config object
  config,

  //overrides:
  [
    // Rules for TypeScript only
    {
      files: ["*.ts", "*.tsx"],
      languageOptions: {
        parser: tsParser,
      },
    },
  ],

  globalIgnores(globalIgnoresFromFile),
]);
