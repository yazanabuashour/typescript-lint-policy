import { noArrayFilterMapRule } from "../vendor/anti-slop/src/rules/no-array-filter-map.ts"
import { noChainedTypeAssertionsRule } from "../vendor/anti-slop/src/rules/no-chained-type-assertions.ts"
import { noConditionalEmptyObjectSpreadRule } from "../vendor/anti-slop/src/rules/no-conditional-empty-object-spread.ts"
import { noModuleMockingRule } from "../vendor/anti-slop/src/rules/no-module-mocking.ts"
import { noReduceAccumulatorCopyRule } from "../vendor/anti-slop/src/rules/no-reduce-accumulator-copy.ts"
import { noReflectApplyRule } from "../vendor/anti-slop/src/rules/no-reflect-apply.ts"
import { noReflectGetRule } from "../vendor/anti-slop/src/rules/no-reflect-get.ts"
import { noForbiddenTermInSymbolNamesRule } from "../vendor/anti-slop/src/rules/no-shape-in-symbol-names.ts"

export const upstreamRules = {
  "no-array-filter-map": noArrayFilterMapRule,
  "no-chained-type-assertions": noChainedTypeAssertionsRule,
  "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
  "no-module-mocking": noModuleMockingRule,
  "no-reduce-accumulator-copy": noReduceAccumulatorCopyRule,
  "no-reflect-apply": noReflectApplyRule,
  "no-reflect-get": noReflectGetRule,
  "no-shape-in-symbol-names": noForbiddenTermInSymbolNamesRule,
}
