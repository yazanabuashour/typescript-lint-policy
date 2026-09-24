import {
  defineRule,
  type ESTree,
  type Options,
  type Scope,
  type SourceCode,
  type Variable,
} from "@oxlint/plugins"

import {
  getPropertyName,
  literalStringValue,
  unwrapExpression,
} from "../shared/ast.ts"

const RUNTIME_PROPERTIES = new Set(["platform", "arch"])

const NODE_OS_MODULES = new Set(["node:os", "os"])

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/")
}

function repoPath(filename: string, cwd: string): string {
  const normalizedFilename = normalizePath(filename)
  const normalizedCwd = normalizePath(cwd).replace(/\/+$/u, "")
  const prefix = `${normalizedCwd}/`

  return normalizedFilename.startsWith(prefix)
    ? normalizedFilename.slice(prefix.length)
    : normalizedFilename
}

interface HostRuntimeOptions {
  readonly allowFiles?: readonly string[]
}

function allowedFiles(
  options: Readonly<Options> | undefined,
): readonly string[] {
  const [option] = options ?? []

  if (option === undefined || option === null) return []
  // SAFETY: Oxlint validates this value against the rule schema before create runs.
  const config = option as HostRuntimeOptions

  return config.allowFiles ?? []
}

function isAllowedFile(
  filename: string,
  cwd: string,
  allowed: readonly string[],
): boolean {
  const path = repoPath(filename, cwd)

  return allowed.some(
    (suffix) => path === suffix || path.endsWith(`/${suffix}`),
  )
}

function resolveVariable(
  sourceCode: SourceCode,
  identifier: ESTree.Node,
): Variable | null {
  if (identifier.type !== "Identifier") return null
  let scope: Scope | null = sourceCode.getScope(identifier)

  while (scope !== null) {
    const variable = scope.set.get(identifier.name)

    if (variable !== undefined) return variable
    scope = scope.upper
  }

  return null
}

function isUnshadowedGlobal(
  sourceCode: SourceCode,
  node: ESTree.Node,
  name: string,
): boolean {
  const expression = unwrapExpression(node)

  if (expression?.type !== "Identifier" || expression.name !== name) {
    return false
  }

  const variable = resolveVariable(sourceCode, expression)

  return variable === null || variable.defs.length === 0
}

function isGlobalProcessObject(
  sourceCode: SourceCode,
  node: ESTree.Node,
): boolean {
  const expression = unwrapExpression(node)

  if (isUnshadowedGlobal(sourceCode, expression ?? node, "process")) return true

  if (expression?.type !== "MemberExpression") return false

  return (
    isUnshadowedGlobal(sourceCode, expression.object, "globalThis") &&
    getPropertyName(expression.property) === "process"
  )
}

function runtimeMessage(property: string): string {
  return `Inject a project-owned host ${property} contract instead of reading process.${property} directly.`
}

export const noGlobalProcessRuntimeRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct host platform and architecture reads outside declared adapter files.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowFiles: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const nodeOsNamespaces = new Set<Variable>()
    const nodeOsRuntimeImports = new Map<Variable, string>()
    const allowed = allowedFiles(context.options)

    function trackImportDeclaration(node: ESTree.ImportDeclaration): void {
      const source = literalStringValue(node.source)

      if (
        source === null ||
        !NODE_OS_MODULES.has(source) ||
        node.importKind === "type"
      )
        return

      const variables = context.sourceCode.getDeclaredVariables(node)

      for (const specifier of node.specifiers) {
        if (
          specifier.type === "ImportSpecifier" &&
          specifier.importKind === "type"
        )
          continue

        const variable = variables.find(
          (binding) => binding.name === specifier.local.name,
        )

        if (variable === undefined) continue

        if (
          specifier.type === "ImportNamespaceSpecifier" ||
          specifier.type === "ImportDefaultSpecifier"
        ) {
          nodeOsNamespaces.add(variable)
          continue
        }

        const imported = getPropertyName(specifier.imported)

        if (imported !== null && RUNTIME_PROPERTIES.has(imported)) {
          nodeOsRuntimeImports.set(variable, imported)
        }
      }
    }

    function nodeOsRuntimeCall(
      callee: ESTree.CallExpression["callee"],
    ): string | null {
      const expression = unwrapExpression(callee)

      if (expression?.type === "Identifier") {
        const variable = resolveVariable(context.sourceCode, expression)

        return variable === null
          ? null
          : (nodeOsRuntimeImports.get(variable) ?? null)
      }

      if (expression?.type !== "MemberExpression") return null

      const object = unwrapExpression(expression.object)

      if (object?.type !== "Identifier") return null
      const variable = resolveVariable(context.sourceCode, object)

      if (variable === null || !nodeOsNamespaces.has(variable)) return null

      const property = getPropertyName(expression.property)

      return property !== null && RUNTIME_PROPERTIES.has(property)
        ? property
        : null
    }

    return {
      ImportDeclaration: trackImportDeclaration,
      MemberExpression(node) {
        if (isAllowedFile(context.filename, context.cwd, allowed)) return
        const property = getPropertyName(node.property)

        if (property === null || !RUNTIME_PROPERTIES.has(property)) return

        if (!isGlobalProcessObject(context.sourceCode, node.object)) return

        context.report({ node, message: runtimeMessage(property) })
      },
      CallExpression(node) {
        if (isAllowedFile(context.filename, context.cwd, allowed)) return
        const property = nodeOsRuntimeCall(node.callee)

        if (property === null) return

        context.report({ node, message: runtimeMessage(property) })
      },
    }
  },
})
