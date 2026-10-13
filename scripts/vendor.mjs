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

const destinationRefusal =
  "Destination must not exist; export to a new sibling directory and inspect before replacing"

// Refuse replacement: the caller owns any existing consumer snapshot.
if (NodeFS.lstatSync(destination, { throwIfNoEntry: false }) !== undefined)
  throw new Error(destinationRefusal)

const buildManifest = NodeFS.readFileSync(
  NodePath.join(root, "dist/SOURCE.json"),
  "utf8",
)

const build = JSON.parse(buildManifest)

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
    "LICENSE.eslint-stylistic",
    "SOURCE.json",
  ],
}

const copiedFiles = manifest.files.filter(
  (file) => !["README.md", "SOURCE.json"].includes(file),
)

const payloadFiles = copiedFiles.filter((file) => file !== "dist")

const consumerReadme = NodeFS.readFileSync(
  NodePath.join(root, "docs/consumer.md"),
)

const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`

const sourcePayload = fileHashes(root, payloadFiles)

const payload = {
  ...sourcePayload,
  "README.md": sha256(consumerReadme),
  "package.json": sha256(manifestBytes),
}

const status = NodeChildProcess.execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=all"],
  { cwd: root, encoding: "utf8" },
)

let commit =
  status === ""
    ? NodeChildProcess.execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim()
    : null

const staging = NodeFS.mkdtempSync(`${destination}.tmp-`)

const failures = []

let destinationOwned = false

let published = false

try {
  for (const file of copiedFiles) {
    NodeFS.cpSync(NodePath.join(root, file), NodePath.join(staging, file), {
      recursive: true,
    })
  }

  NodeFS.writeFileSync(NodePath.join(staging, "README.md"), consumerReadme)
  NodeFS.writeFileSync(NodePath.join(staging, "package.json"), manifestBytes)
  const files = fileHashes(staging, NodeFS.readdirSync(staging))
  NodeAssert.equal(
    files["dist/SOURCE.json"],
    sha256(buildManifest),
    "Build manifest changed while copying; run npm run build",
  )
  NodeAssert.deepEqual(
    Object.fromEntries(
      Object.entries(files)
        .filter(
          ([file]) => file.startsWith("dist/") && file !== "dist/SOURCE.json",
        )
        .map(([file, digest]) => [file.slice("dist/".length), digest]),
    ),
    build.outputs,
    "Compiled output changed while copying; run npm run build",
  )
  NodeAssert.deepEqual(
    Object.fromEntries(
      Object.entries(files).filter(([file]) => !file.startsWith("dist/")),
    ),
    payload,
    "Export payload changed while copying",
  )
  NodeAssert.deepEqual(
    fileHashes(root, payloadFiles),
    sourcePayload,
    "Export source payload changed while copying",
  )
  NodeAssert.equal(
    sha256(NodeFS.readFileSync(NodePath.join(root, "docs/consumer.md"))),
    payload["README.md"],
    "Consumer documentation changed while copying",
  )
  NodeAssert.deepEqual(
    sourceHashes(),
    build.inputs,
    "Build inputs changed while copying; run npm run build",
  )

  if (commit !== null) {
    const finalStatus = NodeChildProcess.execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: root, encoding: "utf8" },
    )

    const finalCommit = NodeChildProcess.execFileSync(
      "git",
      ["rev-parse", "HEAD"],
      {
        cwd: root,
        encoding: "utf8",
      },
    ).trim()

    if (finalStatus !== "" || finalCommit !== commit) commit = null
  }

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

  try {
    NodeFS.mkdirSync(destination, {
      mode: NodeFS.statSync(staging).mode & 0o777,
    })
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(destinationRefusal, { cause: error })

    throw error
  }

  destinationOwned = true

  for (const file of NodeFS.readdirSync(staging)) {
    if (file !== "SOURCE.json")
      NodeFS.renameSync(
        NodePath.join(staging, file),
        NodePath.join(destination, file),
      )
  }

  NodeFS.renameSync(
    NodePath.join(staging, "SOURCE.json"),
    NodePath.join(destination, "SOURCE.json"),
  )
  published = true
} catch (error) {
  failures.push(error)
}

const cleanupErrors = []

const directories = [staging]

if (destinationOwned && !published) directories.push(destination)

for (const directory of directories) {
  try {
    NodeFS.rmSync(directory, { recursive: true, force: true })
  } catch (error) {
    cleanupErrors.push(
      new Error(`Export cleanup failed at ${directory}`, { cause: error }),
    )
  }
}

if (cleanupErrors.length > 0)
  throw new AggregateError(
    [...failures, ...cleanupErrors],
    published
      ? `Export cleanup failed; complete snapshot retained at ${destination}`
      : "Export failed; inspect paths reported by cleanup errors",
    { cause: failures.length > 0 ? failures[0] : cleanupErrors[0] },
  )

if (failures.length > 0) throw failures[0]

console.log(
  `Exported ${build.sourceSha256} to ${destination}${commit === null ? " (uncommitted source; no commit claimed)" : ` (${commit})`}`,
)
