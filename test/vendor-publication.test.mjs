import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"
import { fileHashes, root, sha256 } from "../scripts/integrity.mjs"

const hooks = `import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { syncBuiltinESMExports } from "node:module"
const mkdir = fs.mkdirSync
const rename = fs.renameSync
const remove = fs.rmSync
const observation = { moved: 0, cleanup: [], provenanceLast: false }
const record = () => fs.writeFileSync(eventFile, JSON.stringify(observation))
fs.mkdirSync = (target, options) => {
  if (target === destination && scenario.startsWith("competitor")) {
    mkdir(target)
    if (scenario === "competitor-nonempty") fs.writeFileSync(path.join(target, "owned"), "competitor")
    observation.identity = fs.statSync(target).ino
    record()
  }
  if (target === destination) {
    const parent = path.dirname(target)
    const staging = fs.readdirSync(parent).find(name => name.startsWith(path.basename(target) + ".tmp-"))
    observation.mode = fs.statSync(path.join(parent, staging)).mode & 0o777
  }
  return mkdir(target, options)
}
fs.renameSync = (source, target) => {
  if (path.dirname(target) !== destination) return rename(source, target)
  const provenance = path.basename(target) === "SOURCE.json"
  if (provenance) {
    assert.equal(fs.existsSync(target), false)
    assert.deepEqual(fs.readdirSync(path.dirname(source)), ["SOURCE.json"])
    observation.provenanceLast = true
  }
  if ((scenario === "child" || scenario === "cleanup") && observation.moved === 1) throw new Error("injected child move failure")
  if (scenario === "provenance" && provenance) throw new Error("injected provenance move failure")
  rename(source, target)
  observation.moved++
  record()
}
fs.rmSync = (target, options) => {
  if (target === destination || target.startsWith(destination + ".tmp-")) {
    observation.cleanup.push(target)
    record()
    if (scenario === "cleanup" || scenario === "complete-cleanup") throw new Error("injected cleanup failure at " + target)
  }
  return remove(target, options)
}
syncBuiltinESMExports()
`

function assertSnapshot(destination) {
  const source = JSON.parse(
    NodeFS.readFileSync(NodePath.join(destination, "SOURCE.json"), "utf8"),
  )

  const files = fileHashes(
    destination,
    NodeFS.readdirSync(destination).filter((file) => file !== "SOURCE.json"),
  )

  NodeAssert.deepEqual(files, source.files)
  NodeAssert.equal(sha256(JSON.stringify(files)), source.contentSha256)
}

for (const scenario of [
  "success",
  "competitor-empty",
  "competitor-nonempty",
  "dangling-link",
  "child",
  "provenance",
  "cleanup",
  "complete-cleanup",
]) {
  NodeTest.test(`export publication: ${scenario}`, (context) => {
    const temporary = NodeFS.realpathSync(
      NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "policy-publish-")),
    )

    context.after(() =>
      NodeFS.rmSync(temporary, { recursive: true, force: true }),
    )
    const destination = NodePath.join(temporary, "snapshot")
    const eventFile = NodePath.join(temporary, "events.json")
    const preload = NodePath.join(temporary, "publication.mjs")

    if (scenario === "dangling-link") NodeFS.symlinkSync("missing", destination)

    NodeFS.writeFileSync(
      preload,
      `const destination = ${JSON.stringify(destination)}
const eventFile = ${JSON.stringify(eventFile)}
const scenario = ${JSON.stringify(scenario)}
${hooks}`,
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

    NodeAssert.equal(
      result.status,
      scenario === "success" ? 0 : 1,
      result.stdout + result.stderr,
    )

    if (scenario !== "success")
      NodeAssert.equal(result.stdout.includes("Exported "), false)

    if (scenario === "dangling-link") {
      NodeAssert.match(result.stderr, /Destination must not exist/u)
      NodeAssert.equal(NodeFS.readlinkSync(destination), "missing")
      NodeAssert.equal(NodeFS.existsSync(eventFile), false)
      NodeAssert.deepEqual(NodeFS.readdirSync(temporary).sort(), [
        "publication.mjs",
        "snapshot",
      ])

      return
    }

    const observed = JSON.parse(NodeFS.readFileSync(eventFile, "utf8"))

    const staging = NodeFS.readdirSync(temporary).filter((name) =>
      name.startsWith("snapshot.tmp-"),
    )

    NodeAssert.equal(staging.length, scenario.includes("cleanup") ? 1 : 0)

    if (scenario.startsWith("competitor")) {
      NodeAssert.match(result.stderr, /Destination must not exist/u)
      NodeAssert.equal(NodeFS.statSync(destination).ino, observed.identity)
      NodeAssert.deepEqual(
        NodeFS.readdirSync(destination),
        scenario === "competitor-empty" ? [] : ["owned"],
      )

      if (scenario === "competitor-nonempty")
        NodeAssert.equal(
          NodeFS.readFileSync(NodePath.join(destination, "owned"), "utf8"),
          "competitor",
        )
      NodeAssert.equal(observed.cleanup.includes(destination), false)
    } else if (scenario === "success" || scenario === "complete-cleanup") {
      NodeAssert.equal(observed.provenanceLast, true)
      NodeAssert.equal(NodeFS.statSync(destination).mode & 0o777, observed.mode)
      NodeAssert.equal(observed.cleanup.includes(destination), false)
      assertSnapshot(destination)
    } else {
      NodeAssert.match(
        result.stderr,
        /injected (child|provenance) move failure/u,
      )
      NodeAssert.equal(NodeFS.existsSync(destination), scenario === "cleanup")
      NodeAssert.equal(observed.cleanup.includes(destination), true)
      NodeAssert.ok(observed.moved > 0)

      if (scenario === "provenance")
        NodeAssert.equal(observed.provenanceLast, true)
    }

    if (scenario.includes("cleanup")) {
      NodeAssert.match(result.stderr, /injected cleanup failure/u)
      NodeAssert.ok(
        result.stderr.includes(NodePath.join(temporary, staging[0])),
      )

      if (scenario === "cleanup") {
        NodeAssert.ok(result.stderr.includes(destination))
        NodeAssert.equal(observed.cleanup.length, 2)
        NodeAssert.equal(
          NodeFS.existsSync(NodePath.join(destination, "SOURCE.json")),
          false,
        )
      } else {
        NodeAssert.ok(
          result.stderr.includes(
            `complete snapshot retained at ${destination}`,
          ),
        )
      }
    }
  })
}
