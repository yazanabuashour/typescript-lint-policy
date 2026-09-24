# Update the anti-slop pin

1. Clone [anti-slop](https://github.com/dmmulroy/anti-slop) into a separate
   checkout. Select a full commit ID after reading its changes.

   ```sh
   git clone https://github.com/dmmulroy/anti-slop.git ../anti-slop-candidate
   ```

2. Stage that explicit revision. Replace `<full-commit>` with the selected ID.

   ```sh
   npm run upstream:update -- ../anti-slop-candidate <full-commit>
   ```

   The command copies only paths already listed in `UPSTREAM-SOURCE.json`.
   It reads Git objects, so local edits in the candidate checkout do not enter
   the snapshot. It updates the pin, file hashes, and upstream notice. It does
   not fetch, commit, push, or change local overrides.

3. Inspect the source and license diff.

   ```sh
   git diff -- src/vendor/anti-slop UPSTREAM-SOURCE.json LICENSE.anti-slop LICENSE.eslint-stylistic
   ```

   If upstream adds an import, inspect the required source before adding its
   path to the manifest. Do not copy the upstream package, installers, or skills.
   Keep vendored files exact. Put deliberate differences in local overrides.
   Preserve nested third-party notices. If new runtime declarations or assets
   are needed, include them in `scripts/build.mjs` and the exporter checks;
   TypeScript does not copy input `.d.ts` files or license notices.

4. Compare upstream changes with the retained ports described in
   [UPSTREAM.md](../UPSTREAM.md). Preserve stronger alias analysis, safety-comment
   validation, consumer rule IDs, options, diagnostics, and the measured limits.
   Keep the Effect catch-handler rule's specific guidance ahead of generic Match
   advice. Test compiled-plugin integration and Oxfmt stability as well as the
   unchanged upstream RuleTester cases.

5. Update `UPSTREAM.md` with the new pin and any changed decisions.

6. Run the gates.

   ```sh
   npm ci
   npm run check
   ```

7. Inspect generated `dist/` and obtain checkpoint review of the source delta.
   Commit only after the gates and review pass.

8. Follow [Export a consumer snapshot](export.md) for each consumer. The exporter
   does not discover consumers or change their files automatically.

`npm run upstream:check` verifies the selected file inventory, SHA-256 digests,
and distributed license without network access. This repository has no scheduled
updater, bot, or automatic pull request workflow.
