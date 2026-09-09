import { definePlugin } from "@oxlint/plugins"
import { noServiceConstructorImportsRule } from "../../vendor/anti-slop/src/effect/rules/no-service-constructor-imports.ts"

export default definePlugin({
  meta: { name: "project-effect" },
  rules: { "no-service-constructor-imports": noServiceConstructorImportsRule },
})
