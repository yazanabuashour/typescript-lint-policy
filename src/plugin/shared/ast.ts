import type { ESTree } from "@oxlint/plugins"

type ExpressionWrapper =
  | ESTree.ChainExpression
  | ESTree.ParenthesizedExpression
  | ESTree.TSNonNullExpression
  | ESTree.TSAsExpression
  | ESTree.TSTypeAssertion

export type AstNode = ESTree.Node
export type VisitorKeys = Readonly<Record<string, readonly string[]>>

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
  )
}

/** Oxlint visitor keys identify children; never follow the parent reference. */
export function* childNodes(
  node: AstNode,
  visitorKeys: VisitorKeys,
): Iterable<AstNode> {
  const keys = visitorKeys[node.type] ?? []
  for (const [key, value] of Object.entries(node)) {
    if (!keys.includes(key)) continue
    if (isNode(value)) yield value
    else if (Array.isArray(value)) {
      for (const child of value) if (isNode(child)) yield child
    }
  }
}

function isExpressionWrapper(node: AstNode): node is ExpressionWrapper {
  return (
    node.type === "ChainExpression" ||
    node.type === "ParenthesizedExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion"
  )
}

export function unwrapExpression(
  node: AstNode | null | undefined,
): AstNode | null {
  let current = node ?? null

  while (current !== null && isExpressionWrapper(current)) {
    current = current.expression
  }

  return current
}

export function getPropertyName(
  expression: AstNode | null | undefined,
): string | null {
  if (expression === null || expression === undefined) return null
  if (
    expression.type === "Identifier" ||
    expression.type === "PrivateIdentifier"
  ) {
    return expression.name
  }
  if (expression.type === "Literal" && typeof expression.value === "string") {
    return expression.value
  }
  return null
}

export function isIdentifier(node: AstNode | null, name?: string): boolean {
  return (
    node?.type === "Identifier" && (name === undefined || node.name === name)
  )
}

export function literalStringValue(
  expression: AstNode | null | undefined,
): string | null {
  return expression?.type === "Literal" && typeof expression.value === "string"
    ? expression.value
    : null
}
