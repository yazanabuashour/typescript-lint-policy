import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodePath from "node:path"
import { fileHashes, root, sha256, sourceHashes } from "./integrity.mjs"

const temporary = NodeFS.mkdtempSync(NodePath.join(root, ".lint-policy-build-"))

const output = NodePath.join(temporary, "dist")

const previous = NodePath.join(temporary, "previous")

let preservePrevious = false

try {
  const inputs = sourceHashes()
  NodeChildProcess.execFileSync(
    NodePath.join(root, "node_modules/.bin/tsc"),
    ["-p", NodePath.join(root, "tsconfig.json"), "--outDir", output],
    { cwd: root, stdio: "inherit" },
  )

  // TypeScript does not emit input declarations or third-party license notices.
  const assets = [
    "vendor/anti-slop/LICENSE",
    "vendor/anti-slop/src/vendor/eslint-stylistic/LICENSE",
    "vendor/anti-slop/src/vendor/eslint-stylistic/UPSTREAM.md",
    "vendor/anti-slop/src/vendor/eslint-stylistic/padding-line-options.d.ts",
  ]

  for (const asset of assets) {
    const destination = NodePath.join(output, asset)
    NodeFS.mkdirSync(NodePath.dirname(destination), { recursive: true })
    NodeFS.copyFileSync(NodePath.join(root, "src", asset), destination)
  }

  NodeAssert.deepEqual(sourceHashes(), inputs, "Source changed during build")
  const outputs = fileHashes(output, NodeFS.readdirSync(output))
  NodeFS.writeFileSync(
    NodePath.join(output, "SOURCE.json"),
    `${JSON.stringify(
      {
        sourceSha256: sha256(JSON.stringify(inputs)),
        inputs,
        outputs,
      },
      null,
      2,
    )}\n`,
  )
  const destination = NodePath.join(root, "dist")
  const hadPrevious = NodeFS.existsSync(destination)

  if (hadPrevious) NodeFS.renameSync(destination, previous)

  try {
    NodeFS.renameSync(output, destination)
  } catch (error) {
    if (hadPrevious) {
      try {
        NodeFS.renameSync(previous, destination)
      } catch (rollbackError) {
        preservePrevious = true
        throw new AggregateError(
          [error, rollbackError],
          `Build publication and rollback failed; previous build retained at ${previous}`,
          { cause: rollbackError },
        )
      }
    }

    throw error
  }
} finally {
  if (!preservePrevious)
    NodeFS.rmSync(temporary, { recursive: true, force: true })
}
