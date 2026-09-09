# Export a consumer snapshot

1. Run the producer gates from a complete source checkout.

   ```sh
   npm ci
   npm run check
   ```

2. Review and commit the producer changes before a release export. Development
   exports work before commit, but their `SOURCE.json` has `commit: null`.

3. Choose a new destination outside this repository. Its parent directory must
   exist. The exporter refuses existing destinations, including current consumer
   snapshots.

   ```sh
   npm run vendor -- ../consumer/tools/typescript-lint-policy.next
   ```

4. Inspect the snapshot and its `SOURCE.json`. Compare it with the consumer's
   current snapshot before replacing that directory.

5. Install the snapshot through a local file dependency and run the consumer's
   gates. Follow the consumer's instructions for updating its dependency lockfile.

The export contains compiled JavaScript, declarations, the consumer manifest,
notices, provenance, measured receipts, and a consumer update README. It excludes
development scripts, tests, and dependencies. No build runs in the stripped
snapshot.

The build records every source input and compiled output digest in
`dist/SOURCE.json`. Export refuses changed inputs or outputs until you rebuild.
The exported root `SOURCE.json` records the source digest, file digests, and a
content digest. It records `HEAD` only when Git reports a clean producer tree.
Dirty bytes are identified by content, never mislabeled as a commit. A source
archive without Git metadata can build, but export requires a Git checkout.
