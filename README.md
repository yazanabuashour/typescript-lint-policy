# TypeScript lint policy

`@yazanabuashour/oxlint-config` is a strict Oxlint policy distributed as public
GitHub source under MIT. `private: true` prevents npm publication. It does not
make the source repository private.

The default export combines type-aware native correctness, suspicious,
performance, React Hooks, TypeScript safety, and accessibility rules with the generic
[anti-slop rules](https://github.com/dmmulroy/anti-slop/tree/c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b#generic-rules)
and project-owned Node.js import, host-runtime, Schema compilation, and Effect
test-ownership rules. [UPSTREAM.md](UPSTREAM.md) distinguishes exact upstream
modules from deliberate local overrides and records the ancestry limitation.

Consumers install compiled snapshots from the producer-owned exporter. The
[export guide](docs/export.md) covers installation and updates. A consumer config
uses the default export:

```ts
import policy from "@yazanabuashour/oxlint-config"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [policy],
})
```

## Effect architecture rules

`effectConfig` is an opt-in export for repositories that depend directly on Effect:

```ts
import policy, { effectConfig } from "@yazanabuashour/oxlint-config"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [policy, effectConfig],
})
```

This enables all five `project-effect` rules:

- `no-service-constructor-imports`: reject named `make<CapabilityName>` imports
  from relative modules outside tests. Import the owning Layer and yield the
  contextual service instead. Package imports, path aliases, default imports,
  and static constructors such as `WorkspaceName.make` remain outside its scope.
- `no-manual-effect-error-tag`: use tagged Effect error handlers instead of
  manually branching on `_tag` inside broad catch handlers.
- `no-manual-tag-comparison`: use `Match` or `Predicate.isTagged` instead of
  manual `_tag` comparisons and switches.
- `no-manual-tagged-construction`: use constructors rather than object literals
  with a string `_tag`. Direct `Match.when` and `Match.not` patterns are allowed.
- `prefer-effect-match`: replace chained literal ternaries over the same value
  with `Match`. Tagged branches owned by the catch-handler rule receive only
  its more specific guidance.

These are repository-wide Effect conventions, not type-inferred checks. Tag
rules also cover plain tagged unions; they do not prove that a constructor
exists. Handler and pattern recognition uses the literal `Effect` and `Match`
names. Keep necessary protocol-boundary waivers local and justified. No dependency
or Effect-version discovery runs at configuration time. The project-owned Effect
test rule remains in the default.

## Contracts and local configuration

- Type-aware linting is enabled by default. Install the exact `oxlint`,
  `@oxlint/plugins`, and `oxlint-tsgolint` peer versions from the snapshot.
  Unhandled promises (including `void promise`), promises used as booleans,
  awaiting non-thenables, and non-exhaustive union switches are errors. Await,
  return, or attach a rejection handler to owned async work. Missing typed-lint
  tooling fails the lint run rather than silently falling back to syntax checks.
  Keep `tsc` as a separate gate; Oxlint's experimental compiler diagnostics
  (`typeCheck`) remain disabled.
- Unused lint-disable directives are errors in the exported configuration,
  including consumer runs without a special CLI flag.
- `project/require-readable-spacing` inserts structural blank lines with
  whitespace-only fixes. Consecutive imports, short local bindings, and overloads
  stay grouped. Run `oxlint --fix` for these fixes, then Oxfmt for formatting.
- Runtime `typeof` narrowing remains banned. Comparisons with the string
  `"undefined"` are allowed as existence probes. Set
  `"project/no-runtime-typeof": ["error", { allowInTypeGuards: true }]` to permit
  checks directly inside predicate and assertion functions. The default is false.
- Conditional empty-object spreads remain banned without an autofix. Omitting
  a property is not equivalent to assigning `undefined`.
- `project/require-safety-comment-for-type-assertion` requires a non-empty
  justification. Its optional `markers` array replaces the default `["SAFETY"]`.
  Comments above exported declarations count.
- Adjacent eager array filter/map passes and reducer accumulator copies are
  rejected. Native `oxc/no-accumulating-spread` covers spreads. Review callback
  order, indexes, sparse arrays, ownership, and runtime support before switching
  APIs; these rules do not autofix.
- Custom project and Effect rules use syntax and lexical scope, not full type
  inference. Same-file aliases resolve where supported; imported types and
  cross-file call signatures do not. Unknown array receivers and lazy iterator
  pipelines are outside the array rule. Native type-aware rules use TypeScript
  project information and inferred projects for standalone files.
- `max-lines` remains 300 effective lines and `max-lines-per-function` remains 100. [receipts/size-limits.json](receipts/size-limits.json) records the measurements.
  Consumers own generated-file exemptions, host-runtime adapter allowlists, and
  restricted-import targets. The portable default supplies none of these.

## Source maintenance

The [upstream update guide](docs/update-upstream.md) covers explicit candidate
revisions, source comparison, tests, and review. `npm run check` verifies upstream
integrity, Oxfmt formatting, TypeScript contracts, the generated build, local and
upstream regressions, Oxlint, and package contents. `npm run format` runs Oxfmt;
vendored upstream files and policy snapshots remain untouched. `dist/` is tracked.
[Policy decisions](docs/policy-decisions.md) records the upstream comparison and
which application-specific or weaker settings were deliberately not imported.

[LICENSE](LICENSE) covers project-owned material. [LICENSE.anti-slop](LICENSE.anti-slop)
preserves the upstream notice, including for adapted shared code.
[LICENSE.eslint-stylistic](LICENSE.eslint-stylistic) preserves the spacing engine's
notices. All three ship with the package.
