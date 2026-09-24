import type { ESTree } from "@oxlint/plugins"
import {
  resolvedTypeMatches,
  type TypeAliasEnvironment,
} from "./type-alias-resolution.ts"

export function resolvesToUnknown(
  type: ESTree.TSType,
  environment: TypeAliasEnvironment,
): boolean {
  return resolvedTypeMatches(type, environment, (resolved, matches) => {
    if (resolved.type === "TSUnknownKeyword") return true

    if (resolved.type === "TSParenthesizedType")
      return matches(resolved.typeAnnotation)

    return resolved.type === "TSUnionType" && resolved.types.some(matches)
  })
}
