import type { ESTree } from "@oxlint/plugins"
import {
  createTypeAliasEnvironment,
  hasVisibleTypeBinding,
  type TypeAliasEnvironment,
} from "./type-alias-resolution.ts"

export const TRANSPARENT_WRAPPERS = new Set([
  "Readonly",
  "Partial",
  "Required",
  "NonNullable",
])

export type TypeEnvironment = {
  readonly interfaces: ReadonlyMap<
    string,
    readonly ESTree.TSInterfaceDeclaration[]
  >
  readonly typeAliases: TypeAliasEnvironment
}

export function createTypeEnvironment(
  program: ESTree.Program,
  visitorKeys: Readonly<Record<string, readonly string[]>>,
): TypeEnvironment {
  const interfaces = new Map<string, ESTree.TSInterfaceDeclaration[]>()

  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ||
      statement.type === "ExportDefaultDeclaration"
        ? statement.declaration
        : statement

    if (declaration?.type !== "TSInterfaceDeclaration") continue
    const declarations = interfaces.get(declaration.id.name) ?? []
    declarations.push(declaration)
    interfaces.set(declaration.id.name, declarations)
  }

  return {
    interfaces,
    typeAliases: createTypeAliasEnvironment(program, visitorKeys),
  }
}

export function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null
}

export function isBuiltIn(
  name: string,
  use: ESTree.Node,
  environment: TypeEnvironment,
): boolean {
  return !hasVisibleTypeBinding(name, use, environment.typeAliases)
}

export function unwrapTransparentType(type: ESTree.TSType): ESTree.TSType {
  let current = type

  while (
    current.type === "TSParenthesizedType" ||
    (current.type === "TSTypeOperator" && current.operator === "readonly")
  ) {
    current = current.typeAnnotation
  }

  return current
}
