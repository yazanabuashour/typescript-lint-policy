# TypeScript lint policy

`@yazanabuashour/oxlint-config` is a strict, portable Oxlint policy distributed
as public GitHub source under MIT. `private: true` prevents npm publication;
it does not make the source private. Consumers use compiled snapshots from the
producer-owned exporter, not a registry package.

The default combines type-aware native correctness, suspicious, performance,
React Hooks, TypeScript safety, and accessibility rules with pinned anti-slop
rules and project-owned additions. `effectConfig` adds opt-in Effect conventions.
Consumer-specific exemptions stay in consumer configs.

## Use the policy

- [Install, configure, and update a snapshot](docs/consumer.md): public exports,
  rule behavior, options, limitations, and local waivers. This guide becomes the
  exported snapshot's README.
- [Export a consumer snapshot](docs/export.md): producer gates, release exports,
  and content-addressed provenance.

## Change the policy

Use Node.js 22.18 or newer. From a complete source checkout, run:

```sh
npm ci
npm run check
```

`npm run check` verifies upstream integrity, formatting, TypeScript contracts,
the generated build, local and upstream regressions, Oxlint, and package contents.
It rebuilds tracked `dist/`; inspect that diff along with the source changes.
For focused tests, run `npm run build` before `npm test`. Run `npm run format`
for Oxfmt formatting; exact vendored source and policy snapshots are excluded.
Oxlint's structural spacing fixes use `npm run lint -- --fix` before formatting.

Start with the file that owns the change:

- **Native rules and public configs:** [`src/config.ts`](src/config.ts).
  Readability settings and historical counts live in
  [`receipts/size-limits.json`](receipts/size-limits.json).
- **Generic custom rules:** [`src/plugin/index.ts`](src/plugin/index.ts) composes
  exact imports in [`upstream.ts`](src/plugin/upstream.ts), retained ports in
  [`overrides/`](src/plugin/overrides/), and additions in [`rules/`](src/plugin/rules/).
- **Effect rules:** [`src/plugin/effect/index.ts`](src/plugin/effect/index.ts).
- **Reused syntax and scope analysis:** [`src/plugin/shared/`](src/plugin/shared/).
- **This repository's exemptions:** [`oxlint.config.ts`](oxlint.config.ts), not
  the portable default.
- **Build and snapshot integrity:** [`scripts/build.mjs`](scripts/build.mjs),
  [`integrity.mjs`](scripts/integrity.mjs), and [`vendor.mjs`](scripts/vendor.mjs).
  Exporter regressions live in [`test/vendor.test.mjs`](test/vendor.test.mjs).

Preserve the `project` and `project-effect` namespaces, diagnostics, and options.
[`test/policy.test.mjs`](test/policy.test.mjs) protects config composition and
compiled-plugin behavior; the other `test/*.test.mjs` files cover focused rule
contracts and integration. `npm test` also runs the unchanged upstream RuleTester
cases. Do not edit generated `dist/` directly.

Follow [Update the anti-slop pin](docs/update-upstream.md) for candidate revisions.
[Upstream provenance and local differences](UPSTREAM.md) explains retained ports,
portable policy decisions, and the ancestry limitation. Never patch vendored bytes
locally.

## Licenses

[LICENSE](LICENSE) covers project-owned material.
[LICENSE.anti-slop](LICENSE.anti-slop) covers pinned and adapted upstream code.
[LICENSE.eslint-stylistic](LICENSE.eslint-stylistic) preserves the spacing engine's
notices. All three ship with the package.
