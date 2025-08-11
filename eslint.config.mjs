import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node, // ✅ enables process, __dirname, require, etc.
    },
  },
  pluginJs.configs.recommended,
];
