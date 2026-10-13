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

5. Follow [Install and configure](consumer.md#install-and-configure) for the
   local file dependency and exact peers, then run the consumer's gates. Follow
   the consumer's instructions for updating its dependency lockfile.

The export contains compiled JavaScript, declarations, the consumer manifest,
notices, provenance, measured receipts, and a consumer usage README. It excludes
development scripts, tests, and dependencies. No build runs in the stripped
snapshot.

The build records every source input and compiled output digest in
`dist/SOURCE.json`. It stages output on the producer filesystem and restores the
previous `dist/` if publication fails. If restoration also fails, the error reports
the retained previous build's path for manual recovery.
Export refuses changed inputs or outputs until you rebuild.
It also checks the copied build manifest, all copied outputs, and the remaining
payload, including notices, before exclusively reserving the destination. It
rechecks source inputs and payload bytes after copying. Failed checks remove staging
and leave no snapshot. If Git becomes dirty or `HEAD` changes, the export claims no
commit.

The destination is incomplete while validated children move into it; root
`SOURCE.json` moves last. Wait for successful command completion before inspecting
or using the snapshot. Competing exporters refuse the reserved destination rather
than replacing it. Publication failure removes only this invocation's incomplete
destination and staging. Cleanup failures preserve causes and report paths to
inspect; a completed snapshot survives staging cleanup failure. Abrupt termination
can leave incomplete output or staging, which you must inspect before removing or
retrying.
Export from a quiescent checkout: these checks observe bytes and Git state but do
not lock the working tree.

The exported root `SOURCE.json` records the source digest, file digests, and a
content digest. It records `HEAD` only when Git reports a clean producer tree.
Dirty bytes are identified by content, never mislabeled as a commit. A source
archive without Git metadata can build, but export requires a Git checkout.
