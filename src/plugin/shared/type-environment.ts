import type { ESTree } from "@oxlint/plugins"
import {
  createTypeAliasEnvironment,
  hasVisibleTypeBinding,
  type TypeAliasEnvironment as LexicalTypeAliasEnvironment,
} from "./type-alias-resolution.ts"

export const TRANSPARENT_WRAPPERS = new Set([
  "Readonly",
  "Partial",
  "Required",
  "NonNullable",
])
export type TypeAliasEnvironment = ReadonlyMap<string, ESTree.TSType>
export type TypeEnvironment = {
  readonly interfaces: ReadonlyMap<
    string,
    readonly ESTree.TSInterfaceDeclaration[]
  >
  readonly typeAliases: LexicalTypeAliasEnvironment
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

export function isUnappliedReferenceTo(
  type: ESTree.TSType,
  name: string,
): boolean {
  const unwrapped = unwrapTransparentType(type)
  return (
    unwrapped.type === "TSTypeReference" &&
    typeReferenceName(unwrapped) === name &&
    !unwrapped.typeArguments?.params.length
  )
}

function resolvedSubstitutionArgument(
  type: ESTree.TSType,
  base: TypeAliasEnvironment,
  resolving: ReadonlySet<string> = new Set(),
): ESTree.TSType {
  const unwrapped = unwrapTransparentType(type)
  if (unwrapped.type !== "TSTypeReference") return type
  const name = typeReferenceName(unwrapped)
  if (name === null || resolving.has(name)) return type
  const substitution = base.get(name)
  if (substitution === undefined) return type
  return resolvedSubstitutionArgument(
    substitution,
    base,
    new Set([...resolving, name]),
  )
}

export function aliasSubstitution(
  alias: ESTree.TSTypeAliasDeclaration,
  type: ESTree.TSTypeReference,
  base: TypeAliasEnvironment,
): TypeAliasEnvironment | null {
  const parameters = alias.typeParameters?.params ?? []
  const typeArguments = type.typeArguments?.params ?? []
  const next = new Map(base)
  for (const [index, parameter] of parameters.entries()) {
    const argument = typeArguments[index] ?? parameter.default
    if (argument === null || argument === undefined) return null
    next.set(parameter.name.name, resolvedSubstitutionArgument(argument, next))
  }
  return next
}
