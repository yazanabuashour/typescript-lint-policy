import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"
import { fileHashes, root } from "../scripts/integrity.mjs"

function copyProducer(producer) {
  for (const entry of [
    "src",
    "scripts",
    "tools",
    "dist",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
    "UPSTREAM-SOURCE.json",
  ]) {
    NodeFS.cpSync(NodePath.join(root, entry), NodePath.join(producer, entry), {
      recursive: true,
    })
  }

  NodeFS.symlinkSync(
    NodePath.join(root, "node_modules"),
    NodePath.join(producer, "node_modules"),
    "dir",
  )
}

NodeTest.test(
  "build publication preserves prior output on failure",
  (context) => {
    const temporary = NodeFS.mkdtempSync(
      NodePath.join(NodeOS.tmpdir(), "lint-policy-build-test-"),
    )

    context.after(() =>
      NodeFS.rmSync(temporary, { recursive: true, force: true }),
    )
    const producer = NodePath.join(temporary, "producer")

    copyProducer(producer)
    const destination = NodePath.join(producer, "dist")
    NodeFS.writeFileSync(
      NodePath.join(destination, "stale.js"),
      "previous output",
    )
    const before = fileHashes(destination, NodeFS.readdirSync(destination))
    const preload = NodePath.join(temporary, "fail-publication.mjs")

    for (const failRollback of [false, true]) {
      NodeFS.writeFileSync(
        preload,
        `import fs from "node:fs"
import path from "node:path"
import { syncBuiltinESMExports } from "node:module"
const rename = fs.renameSync
fs.renameSync = (source, destination) => {
  if (destination === ${JSON.stringify(destination)} &&
      (path.basename(source) === "dist" || ${failRollback})) {
    throw new Error("injected " + path.basename(source) + " rename failure")
  }
  return rename(source, destination)
}
syncBuiltinESMExports()
`,
      )

      const result = NodeChildProcess.spawnSync(
        process.execPath,
        ["--import", preload, NodePath.join(producer, "scripts/build.mjs")],
        { encoding: "utf8" },
      )

      NodeAssert.equal(result.status, 1, result.stdout + result.stderr)
      NodeAssert.match(result.stderr, /injected dist rename failure/u)

      const staging = NodeFS.readdirSync(producer).filter((entry) =>
        entry.startsWith(".lint-policy-build-"),
      )

      if (failRollback) {
        NodeAssert.match(result.stderr, /injected previous rename failure/u)
        NodeAssert.match(result.stderr, /previous build retained at/u)
        NodeAssert.equal(staging.length, 1)
        const previous = NodePath.join(producer, staging[0], "previous")
        NodeAssert.ok(result.stderr.includes(previous), result.stderr)
        NodeAssert.equal(NodeFS.existsSync(destination), false)
        NodeAssert.deepEqual(
          fileHashes(previous, NodeFS.readdirSync(previous)),
          before,
        )
        NodeFS.renameSync(previous, destination)
        NodeFS.rmSync(NodePath.join(producer, staging[0]), {
          recursive: true,
          force: true,
        })
      } else {
        NodeAssert.deepEqual(staging, [])
        NodeAssert.deepEqual(
          fileHashes(destination, NodeFS.readdirSync(destination)),
          before,
        )
      }
    }

    NodeChildProcess.execFileSync(process.execPath, [
      NodePath.join(producer, "scripts/build.mjs"),
    ])
    NodeAssert.equal(
      NodeFS.existsSync(NodePath.join(destination, "stale.js")),
      false,
    )

    const build = JSON.parse(
      NodeFS.readFileSync(NodePath.join(destination, "SOURCE.json"), "utf8"),
    )

    NodeAssert.deepEqual(
      fileHashes(
        destination,
        NodeFS.readdirSync(destination).filter(
          (file) => file !== "SOURCE.json",
        ),
      ),
      build.outputs,
    )
    NodeAssert.deepEqual(
      NodeFS.readdirSync(producer).filter((entry) =>
        entry.startsWith(".lint-policy-build-"),
      ),
      [],
    )
  },
)
