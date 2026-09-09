import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodePath from "node:path"
import { fileHashes, root, sha256, sourceHashes } from "./integrity.mjs"
import "./upstream.mjs"

const [argument, ...extra] = process.argv.slice(2)
if (!argument || extra.length)
  throw new Error("Usage: npm run vendor -- <destination>")
const resolved = NodePath.resolve(argument)
const destination = NodePath.join(
  NodeFS.realpathSync(NodePath.dirname(resolved)),
  NodePath.basename(resolved),
)
function contains(parent, child) {
  const relative = NodePath.relative(parent, child)
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${NodePath.sep}`) &&
      !NodePath.isAbsolute(relative))
  )
}
if (contains(root, destination) || contains(destination, root)) {
  throw new Error("Export outside the producer tree")
}
// Refuse replacement: the caller owns any existing consumer snapshot.
if (NodeFS.existsSync(destination))
  throw new Error(
    "Destination must not exist; export to a new sibling directory and inspect before replacing",
  )
const build = JSON.parse(
  NodeFS.readFileSync(NodePath.join(root, "dist/SOURCE.json"), "utf8"),
)
NodeAssert.deepEqual(
  sourceHashes(),
  build.inputs,
  "Build inputs changed; run npm run build",
)
NodeAssert.equal(
  sha256(JSON.stringify(build.inputs)),
  build.sourceSha256,
  "Build source digest mismatch",
)
NodeAssert.deepEqual(
  fileHashes(
    NodePath.join(root, "dist"),
    NodeFS.readdirSync(NodePath.join(root, "dist")).filter(
      (file) => file !== "SOURCE.json",
    ),
  ),
  build.outputs,
  "Compiled output changed; run npm run build",
)
const producer = JSON.parse(
  NodeFS.readFileSync(NodePath.join(root, "package.json"), "utf8"),
)
const manifest = {
  name: producer.name,
  version: producer.version,
  private: true,
  type: producer.type,
  description: producer.description,
  license: producer.license,
  repository: producer.repository,
  exports: producer.exports,
  engines: producer.engines,
  peerDependencies: producer.peerDependencies,
  files: [
    "dist",
    "receipts",
    "README.md",
    "UPSTREAM.md",
    "UPSTREAM-SOURCE.json",
    "LICENSE",
    "LICENSE.anti-slop",
    "SOURCE.json",
  ],
}
const status = NodeChildProcess.execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=all"],
  { cwd: root, encoding: "utf8" },
)
const commit =
  status === ""
    ? NodeChildProcess.execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim()
    : null
const staging = NodeFS.mkdtempSync(`${destination}.tmp-`)
try {
  for (const file of manifest.files.filter(
    (file) => !["README.md", "SOURCE.json"].includes(file),
  )) {
    NodeFS.cpSync(NodePath.join(root, file), NodePath.join(staging, file), {
      recursive: true,
    })
  }
  NodeFS.copyFileSync(
    NodePath.join(root, "docs/consumer.md"),
    NodePath.join(staging, "README.md"),
  )
  NodeFS.writeFileSync(
    NodePath.join(staging, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  const files = fileHashes(staging, NodeFS.readdirSync(staging))
  NodeFS.writeFileSync(
    NodePath.join(staging, "SOURCE.json"),
    `${JSON.stringify(
      {
        repository: producer.repository.url,
        commit,
        sourceSha256: build.sourceSha256,
        contentSha256: sha256(JSON.stringify(files)),
        files,
      },
      null,
      2,
    )}\n`,
  )
  NodeFS.renameSync(staging, destination)
} finally {
  NodeFS.rmSync(staging, { recursive: true, force: true })
}
console.log(
  `Exported ${build.sourceSha256} to ${destination}${commit === null ? " (uncommitted source; no commit claimed)" : ` (${commit})`}`,
)
