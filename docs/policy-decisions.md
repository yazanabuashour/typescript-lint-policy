# Policy decisions

Keep shared safety checks strict. Import upstream improvements, not application
exceptions or legacy-debt allowances.

## Compared sources

The September 23, 2026 update inspected:

- [anti-slop at c44ef22](https://github.com/dmmulroy/anti-slop/tree/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b):
  rule implementations, tests, shared helpers, and nested ESLint Stylistic assets.
  This remained its default-branch revision when rechecked for this update.
- [T3 Code at d4cd7d5](https://github.com/pingdotgg/t3code/tree/d4cd7d5c33122473da22ae118c93477ef7e38310):
  `vite.config.ts`, `tsconfig.base.json`, `oxlint-plugin-t3code/`, and tool locks.

`UPSTREAM-SOURCE.json` pins every imported anti-slop file. T3 Code informed policy
choices; this update does not vendor its application plugins.

## Adopted improvements

- Structural spacing with safe autofixes, alongside Oxfmt rather than Biome.
  Exact upstream sources and policy snapshots stay excluded from formatting.
- All new Effect tagged-value rules, in the existing Effect-specific config.
  The local Match override defers tagged catch-handler branches to the more
  specific error-handler rule instead of issuing competing advice. The local
  tag-rule ports also stop at nested function declarations, matching arrow and
  function-expression boundaries instead of misattributing nested branches to
  the outer handler.
- Native type-aware linting by default, with an exact `oxlint-tsgolint` peer.
  Reject floating promises even when prefixed with `void`, misused promises,
  awaiting non-thenables, and non-exhaustive union switches. Keep the TypeScript
  compiler as a separate gate rather than using experimental lint-time compiler
  diagnostics.
- Error-level unused-disable reporting in the exported configuration, not only
  this repository's command line.
- Binding-identity checks for imported `node:os` functions and namespaces. Real
  host-runtime reads still fail; shadowed injected contracts and type-only
  imports no longer receive unrelated diagnostics.
- Compiler checks for incomplete returns, unused locals and parameters, and
  declaration files through the refreshed TypeScript policy snapshot.
- Direct, aligned Oxlint and plugin SDK versions. No Vite+ dependency is needed
  to use the underlying linter and formatter.

## Deliberately not imported

T3 Code's warning severities, disabled React exhaustive-dependency checking, and
manual Effect runtime debt ceilings would weaken this policy. Its Hermes API
restrictions, tooltip components, mobile styling rules, aliases, and framework
settings are application contracts, not portable defaults. Keep those in their
own consumers.

The existing local alias analysis, Node.js `node:test` import exception, schema
compiler checks, and host-runtime adapter contract remain stronger or more
portable than their T3 counterparts. Keep them rather than replacing them with
name-only checks.

T3 Code disables typed linting pending its Effect compiler integration. That is
not a portable reason to skip semantic checks here: probes using Oxlint 1.85.0
and `oxlint-tsgolint` 7.0.2002 caught the four targeted error classes in standalone
files and TypeScript projects, including explicitly excluded files and JSDoc
JavaScript. A missing backend exited unsuccessfully with an installation error.
Our adoption needed an explicit comparator preserving locale-independent
provenance ordering and one local exhaustiveness waiver: an AST predicate
intentionally recognizes only a subset of node kinds. The shared switch rule
remains strict.

Effect's tag conventions are intentionally strict across an opted-in repository.
They are syntactic, not proof that a tagged constructor exists or that a name
refers to an Effect import. Consumers own justified protocol-boundary waivers;
the shared policy adds no blanket exemptions.

## Verification

The type-aware integration test asserts semantic diagnostics and accepted code
through the compiled policy; a silently disabled backend cannot pass it.

`npm run check` exercises the compiled package, vendored upstream regressions,
local overrides, exporter integrity, formatting, and compiler contracts. The
spacing integration regression checks Oxlint autofixes and Oxfmt together. Build
and export checks preserve ESLint Stylistic notices and required declaration
inputs instead of shipping an incomplete snapshot.
