import { defineConfig } from "oxlint"

import policy from "./src/config.ts"

export default defineConfig({
  extends: [policy],
  ignorePatterns: ["dist", "src/vendor/anti-slop"],
  overrides: [
    {
      files: ["src/plugin/shared/ast.ts"],
      rules: {
        "project/no-runtime-typeof": "off",
      },
    },
  ],
})
