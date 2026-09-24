import type { ESTree } from "@oxlint/plugins"
import { isInsideBroadEffectHandler as upstreamIsInsideBroadEffectHandler } from "../../vendor/anti-slop/src/effect/shared/tagged-values.ts"

/** Upstream skips declaration boundaries; every function owns its own branches. */
export function isInsideBroadEffectHandler(node: ESTree.Node): boolean {
  let current = node.parent

  while (current !== null && current !== undefined) {
    if (current.type === "FunctionDeclaration") return false

    if (
      current.type === "ArrowFunctionExpression" ||
      current.type === "FunctionExpression"
    ) {
      return upstreamIsInsideBroadEffectHandler(node)
    }

    current = current.parent
  }

  return false
}
