import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"
import { root } from "../scripts/integrity.mjs"

NodeTest.test(
  "refuses copied and source changes during export and removes staging",
  (context) => {
    const temporary = NodeFS.mkdtempSync(
      NodePath.join(NodeOS.tmpdir(), "policy-copy-"),
    )

    context.after(() =>
      NodeFS.rmSync(temporary, { recursive: true, force: true }),
    )
    const destination = NodePath.join(temporary, "snapshot")
    const preload = NodePath.join(temporary, "mutate-copy.mjs")

    for (const [entry, file, expected, mutateSource = false] of [
      ["dist", "config.js", "Compiled output changed while copying"],
      ["dist", "SOURCE.json", "Build manifest changed while copying"],
      ["LICENSE.anti-slop", null, "Export payload changed while copying"],
      [
        "LICENSE.anti-slop",
        "LICENSE.anti-slop",
        "Export source payload changed while copying",
        true,
      ],
      ["dist", "src/config.ts", "Build inputs changed while copying", true],
    ]) {
      NodeFS.writeFileSync(
        preload,
        `import fs from "node:fs"
import path from "node:path"
import { syncBuiltinESMExports } from "node:module"
const copy = fs.cpSync
const read = fs.readFileSync
let copied = false
fs.cpSync = (source, destination, options) => {
  copy(source, destination, options)
  if (source === ${JSON.stringify(NodePath.join(root, entry))}) {
    copied = true
    if (!${mutateSource}) fs.appendFileSync(${file === null ? "destination" : `path.join(destination, ${JSON.stringify(file)})`}, "\\n")
  }
}
if (${mutateSource}) fs.readFileSync = (source, ...options) => {
  const bytes = read(source, ...options)
  return copied && source === ${JSON.stringify(NodePath.join(root, file ?? entry))}
    ? Buffer.concat([bytes, Buffer.from("\\n")]) : bytes
}
syncBuiltinESMExports()
`,
      )

      const result = NodeChildProcess.spawnSync(
        process.execPath,
        [
          "--import",
          preload,
          NodePath.join(root, "scripts/vendor.mjs"),
          destination,
        ],
        { encoding: "utf8" },
      )

      NodeAssert.equal(result.status, 1, result.stdout + result.stderr)
      NodeAssert.ok(result.stderr.includes(expected), result.stderr)
      NodeAssert.deepEqual(NodeFS.readdirSync(temporary), ["mutate-copy.mjs"])
    }
  },
)
