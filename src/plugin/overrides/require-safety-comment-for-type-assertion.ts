import type { ESTree, SourceCode } from "@oxlint/plugins"
import { defineRule } from "@oxlint/plugins"

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion

const DEFAULT_SAFETY_MARKERS = ["SAFETY"] as const

const commentOwnerKinds = new Set([
  "ExpressionStatement",
  "PropertyDefinition",
  "ReturnStatement",
  "ThrowStatement",
  "VariableDeclaration",
])

function isConstAssertion(node: TypeAssertion): boolean {
  return (
    node.typeAnnotation.type === "TSTypeReference" &&
    node.typeAnnotation.typeName.type === "Identifier" &&
    node.typeAnnotation.typeName.name === "const"
  )
}

interface SafetyCommentOptions {
  readonly markers?: readonly string[]
}

function configuredSafetyMarkers(
  option: SafetyCommentOptions | undefined,
): readonly string[] {
  const markers =
    option?.markers?.flatMap((marker) =>
      marker.trim() ? [marker.trim()] : [],
    ) ?? []

  return markers.length > 0 ? markers : DEFAULT_SAFETY_MARKERS
}

function markerPattern(markers: readonly string[]): RegExp {
  const alternation = markers
    .map((marker) => marker.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`))
    .join("|")

  return new RegExp(
    String.raw`(?:^|[^\p{L}\p{N}_])(?:${alternation})\s*:\s*\S`,
    "u",
  )
}

function hasSafetyJustificationBefore(
  sourceCode: SourceCode,
  owner: ESTree.Node,
  assertion: TypeAssertion,
  pattern: RegExp,
): boolean {
  return sourceCode
    .getCommentsBefore(owner)
    .some(
      (comment) =>
        comment.end <= assertion.start &&
        pattern.test(comment.value.replaceAll(/^[\t ]*\*(?:[\t ]|$)/gmu, "")),
    )
}

function hasSafetyComment(
  sourceCode: SourceCode,
  node: TypeAssertion,
  pattern: RegExp,
): boolean {
  let current: ESTree.Node = node

  while (true) {
    if (hasSafetyJustificationBefore(sourceCode, current, node, pattern))
      return true

    if (commentOwnerKinds.has(current.type)) {
      const exportDeclaration = current.parent

      return (
        exportDeclaration.type === "ExportNamedDeclaration" &&
        exportDeclaration.declaration === current &&
        hasSafetyJustificationBefore(
          sourceCode,
          exportDeclaration,
          node,
          pattern,
        )
      )
    }

    if (current.parent.type === "Program") return false
    current = current.parent
  }
}

/** Require every non-const type assertion to state the invariant TypeScript cannot express. */
export const requireSafetyCommentForTypeAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a nearby SAFETY comment for every TypeScript type assertion except const assertions.",
    },
    messages: {
      missingSafetyComment:
        "This type assertion has no `{{marker}}:` justification. State the checked invariant immediately before the assertion or its containing statement.",
    },
    schema: [
      {
        type: "object",
        properties: {
          markers: {
            type: "array",
            items: { type: "string", minLength: 1 },
            minItems: 1,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ markers: ["SAFETY"] }],
  },
  create(context) {
    // SAFETY: Oxlint validates options against the rule schema before create.
    const [option] = context.options as readonly SafetyCommentOptions[]
    const markers = configuredSafetyMarkers(option)
    const pattern = markerPattern(markers)

    const checkAssertion = (node: TypeAssertion) => {
      if (isConstAssertion(node)) return

      if (hasSafetyComment(context.sourceCode, node, pattern)) return
      context.report({
        node,
        messageId: "missingSafetyComment",
        data: { marker: markers[0] ?? DEFAULT_SAFETY_MARKERS[0] },
      })
    }

    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    }
  },
})
