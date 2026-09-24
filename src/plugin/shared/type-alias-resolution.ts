import type { ESTree } from "@oxlint/plugins"
import { childNodes, type VisitorKeys } from "./ast.ts"
import { lexicalTypeParameterBinding } from "./lexical-type-parameters.ts"

type TypeScope = ESTree.Node

type TypeBinding = {
  readonly declaration: ESTree.Node
  readonly scope: TypeScope
}

type Substitution = {
  readonly substitutions: Substitutions
  readonly resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>
  readonly type: ESTree.TSType
}

type Substitutions = ReadonlyMap<ESTree.Node, Substitution>

export type TypeAliasEnvironment = {
  readonly bindingsByName: ReadonlyMap<string, readonly TypeBinding[]>
  readonly visitorKeys: VisitorKeys
}

export type ResolvedTypeMatcher = (
  type: ESTree.TSType,
  matches: (child: ESTree.TSType) => boolean,
) => boolean

const environmentsByProgram = new WeakMap<
  ESTree.Program,
  TypeAliasEnvironment
>()

function enclosingTypeScope(node: ESTree.Node): TypeScope {
  let current: ESTree.Node | null = node.parent

  while (current !== null) {
    if (
      current.type === "Program" ||
      current.type === "BlockStatement" ||
      current.type === "TSModuleBlock" ||
      current.type === "StaticBlock" ||
      current.type === "SwitchStatement"
    ) {
      return current
    }

    current = current.parent
  }

  return node
}

function declaredTypeBinding(node: ESTree.Node): {
  readonly declaration: ESTree.Node
  readonly name: string
} | null {
  if (
    node.type === "TSTypeAliasDeclaration" ||
    node.type === "TSInterfaceDeclaration" ||
    node.type === "TSEnumDeclaration" ||
    node.type === "ClassDeclaration" ||
    node.type === "ClassExpression"
  ) {
    return node.id === null ? null : { declaration: node, name: node.id.name }
  }

  if (
    node.type === "ImportSpecifier" ||
    node.type === "ImportDefaultSpecifier" ||
    node.type === "ImportNamespaceSpecifier"
  ) {
    return { declaration: node, name: node.local.name }
  }

  return null
}

function collectTypeBindings(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
  bindingsByName: Map<string, TypeBinding[]>,
): void {
  const declared = declaredTypeBinding(node)

  if (declared !== null) {
    const bindings = bindingsByName.get(declared.name) ?? []
    bindings.push({
      declaration: declared.declaration,
      scope: node.type === "ClassExpression" ? node : enclosingTypeScope(node),
    })
    bindingsByName.set(declared.name, bindings)
  }

  for (const child of childNodes(node, visitorKeys)) {
    collectTypeBindings(child, visitorKeys, bindingsByName)
  }
}

/** Collect every lexical type alias and competing type binding in a program. */
export function createTypeAliasEnvironment(
  program: ESTree.Program,
  visitorKeys: VisitorKeys,
): TypeAliasEnvironment {
  const cached = environmentsByProgram.get(program)

  if (cached !== undefined) return cached
  const bindingsByName = new Map<string, TypeBinding[]>()
  collectTypeBindings(program, visitorKeys, bindingsByName)
  const environment = { bindingsByName, visitorKeys }
  environmentsByProgram.set(program, environment)

  return environment
}

function ancestorDistance(
  ancestor: ESTree.Node,
  node: ESTree.Node,
): number | null {
  let current: ESTree.Node | null = node
  let distance = 0

  while (current !== null) {
    if (current === ancestor) return distance
    current = current.parent
    distance += 1
  }

  return null
}

function nearestTypeBindings(
  name: string,
  use: ESTree.Node,
  environment: TypeAliasEnvironment,
): readonly TypeBinding[] {
  const parameter = lexicalTypeParameterBinding(
    name,
    use,
    environment.visitorKeys,
  )

  const candidates = [
    ...(environment.bindingsByName.get(name) ?? []),
    ...(parameter === null ? [] : [parameter]),
  ]

  let nearestDistance = Number.POSITIVE_INFINITY
  let nearest: TypeBinding[] = []

  for (const candidate of candidates) {
    const distance = ancestorDistance(candidate.scope, use)

    if (distance === null || distance > nearestDistance) continue

    if (distance === nearestDistance) {
      nearest.push(candidate)
      continue
    }

    nearestDistance = distance
    nearest = [candidate]
  }

  return nearest
}

/** Resolve the nearest visible alias with this name, respecting lexical shadowing. */
export function visibleTypeAlias(
  name: string,
  use: ESTree.Node,
  environment: TypeAliasEnvironment,
): ESTree.TSTypeAliasDeclaration | null {
  const bindings = nearestTypeBindings(name, use, environment)
  const declaration = bindings.length === 1 ? bindings[0]?.declaration : null

  return declaration?.type === "TSTypeAliasDeclaration" ? declaration : null
}

/** Return whether a local declaration shadows a built-in type at this use. */
export function hasVisibleTypeBinding(
  name: string,
  use: ESTree.Node,
  environment: TypeAliasEnvironment,
): boolean {
  return nearestTypeBindings(name, use, environment).length > 0
}

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null
}

function aliasSubstitutions(
  alias: ESTree.TSTypeAliasDeclaration,
  reference: ESTree.TSTypeReference,
  base: Substitutions,
  resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>,
): Substitutions | null {
  const parameters = alias.typeParameters?.params ?? []
  const arguments_ = reference.typeArguments?.params ?? []
  const next = new Map(base)

  for (const [index, parameter] of parameters.entries()) {
    const explicitArgument = arguments_[index]
    const argument = explicitArgument ?? parameter.default

    if (argument === null || argument === undefined) return null
    // Explicit arguments belong to the caller; defaults belong to this alias.
    const argumentSubstitutions = explicitArgument === undefined ? next : base
    next.set(parameter, {
      type: argument,
      substitutions: new Map(argumentSubstitutions),
      resolvingAliases:
        explicitArgument === undefined
          ? new Set([...resolvingAliases, alias])
          : resolvingAliases,
    })
  }

  return next
}

/** Match a type after resolving visible aliases and substituting their type parameters. */
export function resolvedTypeMatches(
  type: ESTree.TSType,
  environment: TypeAliasEnvironment,
  matcher: ResolvedTypeMatcher,
): boolean {
  const evaluate = (
    current: ESTree.TSType,
    substitutions: Substitutions,
    resolvingAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>,
  ): boolean => {
    if (current.type === "TSTypeReference") {
      const name = typeReferenceName(current)

      if (name !== null) {
        const bindings = nearestTypeBindings(name, current, environment)

        const declaration =
          bindings.length === 1 ? bindings[0]?.declaration : null

        const substitution =
          declaration == null ? undefined : substitutions.get(declaration)

        if (
          substitution !== undefined &&
          !current.typeArguments?.params.length
        ) {
          // Resume the argument's caller context, not the alias body's cycle guard.
          return evaluate(
            substitution.type,
            substitution.substitutions,
            substitution.resolvingAliases,
          )
        }

        const alias =
          declaration?.type === "TSTypeAliasDeclaration" ? declaration : null

        if (alias !== null && !resolvingAliases.has(alias)) {
          const nextSubstitutions = aliasSubstitutions(
            alias,
            current,
            substitutions,
            resolvingAliases,
          )

          if (nextSubstitutions !== null) {
            const nextResolving = new Set(resolvingAliases)
            nextResolving.add(alias)

            return evaluate(
              alias.typeAnnotation,
              nextSubstitutions,
              nextResolving,
            )
          }
        }
      }
    }

    return matcher(current, (child) =>
      evaluate(child, substitutions, resolvingAliases),
    )
  }

  return evaluate(type, new Map(), new Set())
}
