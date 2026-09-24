import { definePlugin } from "@oxlint/plugins"
import { noServiceConstructorImportsRule } from "../../vendor/anti-slop/src/effect/rules/no-service-constructor-imports.ts"
import { noManualEffectErrorTagRule } from "./no-manual-effect-error-tag.ts"
import { noManualTagComparisonRule } from "./no-manual-tag-comparison.ts"
import { noManualTaggedConstructionRule } from "../../vendor/anti-slop/src/effect/rules/no-manual-tagged-construction.ts"
import { preferEffectMatchRule } from "./prefer-effect-match.ts"

export default definePlugin({
  meta: { name: "project-effect" },
  rules: {
    "no-service-constructor-imports": noServiceConstructorImportsRule,
    "no-manual-effect-error-tag": noManualEffectErrorTagRule,
    "no-manual-tag-comparison": noManualTagComparisonRule,
    "no-manual-tagged-construction": noManualTaggedConstructionRule,
    "prefer-effect-match": preferEffectMatchRule,
  },
})
