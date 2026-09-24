import { defineRule } from "@oxlint/plugins"
import { noManualTagComparisonRule as upstreamRule } from "../../vendor/anti-slop/src/effect/rules/no-manual-tag-comparison.ts"
import {
  isTagMember,
  tagMemberFromComparison,
} from "../../vendor/anti-slop/src/effect/shared/tagged-values.ts"
import { isInsideBroadEffectHandler } from "./tagged-values.ts"

export const noManualTagComparisonRule = defineRule({
  ...upstreamRule,
  createOnce(context) {
    return {
      BinaryExpression(node) {
        if (
          tagMemberFromComparison(node) === undefined ||
          isInsideBroadEffectHandler(node)
        )
          return

        context.report({ node, messageId: "manualComparison" })
      },
      SwitchStatement(node) {
        if (!isTagMember(node.discriminant) || isInsideBroadEffectHandler(node))
          return

        context.report({ node, messageId: "manualSwitch" })
      },
    }
  },
})
