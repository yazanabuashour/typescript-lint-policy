import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import { fileHashes, root, sha256, sourceHashes } from "./integrity.mjs"

const temporary = NodeFS.mkdtempSync(
  NodePath.join(NodeOS.tmpdir(), "lint-policy-build-"),
)

try {
  const inputs = sourceHashes()
  NodeChildProcess.execFileSync(
    NodePath.join(root, "node_modules/.bin/tsc"),
    ["-p", NodePath.join(root, "tsconfig.json"), "--outDir", temporary],
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
    const destination = NodePath.join(temporary, asset)
    NodeFS.mkdirSync(NodePath.dirname(destination), { recursive: true })
    NodeFS.copyFileSync(NodePath.join(root, "src", asset), destination)
  }

  NodeAssert.deepEqual(sourceHashes(), inputs, "Source changed during build")
  const outputs = fileHashes(temporary, NodeFS.readdirSync(temporary))
  NodeFS.writeFileSync(
    NodePath.join(temporary, "SOURCE.json"),
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
  NodeFS.rmSync(destination, { recursive: true, force: true })
  NodeFS.cpSync(temporary, destination, { recursive: true })
} finally {
  NodeFS.rmSync(temporary, { recursive: true, force: true })
}
