import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"
import * as NodeURL from "node:url"
import { fileHashes, root, sha256 } from "../scripts/integrity.mjs"

function runExporter(producer, destination) {
  return NodeChildProcess.spawnSync(
    process.execPath,
    [NodePath.join(producer, "scripts/vendor.mjs"), destination],
    { encoding: "utf8" },
  )
}

function assertBuildAssets(destination, build) {
  for (const asset of [
    "vendor/anti-slop/LICENSE",
    "vendor/anti-slop/src/vendor/eslint-stylistic/LICENSE",
    "vendor/anti-slop/src/vendor/eslint-stylistic/UPSTREAM.md",
    "vendor/anti-slop/src/vendor/eslint-stylistic/padding-line-options.d.ts",
  ]) {
    const bytes = NodeFS.readFileSync(NodePath.join(root, "src", asset))
    NodeAssert.deepEqual(
      NodeFS.readFileSync(NodePath.join(destination, "dist", asset)),
      bytes,
    )
    NodeAssert.equal(build.outputs[asset], sha256(bytes))
    NodeAssert.equal(build.inputs[`src/${asset}`], sha256(bytes))
  }
}

NodeTest.test(
  "exports a usable, stripped snapshot with byte-addressed provenance",
  async (context) => {
    const temporary = NodeFS.mkdtempSync(
      NodePath.join(NodeOS.tmpdir(), "lint-policy-export-"),
    )

    context.after(() =>
      NodeFS.rmSync(temporary, { recursive: true, force: true }),
    )
    const destination = NodePath.join(temporary, "policy")
    const result = runExporter(root, destination)
    NodeAssert.equal(result.status, 0, result.stdout + result.stderr)

    const manifest = JSON.parse(
      NodeFS.readFileSync(NodePath.join(destination, "package.json"), "utf8"),
    )

    NodeAssert.equal(manifest.private, true)
    NodeAssert.equal(manifest.license, "MIT")
    NodeAssert.equal(manifest.scripts, undefined)
    NodeAssert.equal(manifest.devDependencies, undefined)

    for (const file of [
      "LICENSE",
      "LICENSE.anti-slop",
      "LICENSE.eslint-stylistic",
      "UPSTREAM-SOURCE.json",
      "UPSTREAM.md",
    ]) {
      NodeAssert.deepEqual(
        NodeFS.readFileSync(NodePath.join(destination, file)),
        NodeFS.readFileSync(NodePath.join(root, file)),
      )
    }

    const source = JSON.parse(
      NodeFS.readFileSync(NodePath.join(destination, "SOURCE.json"), "utf8"),
    )

    const files = fileHashes(
      destination,
      NodeFS.readdirSync(destination).filter((file) => file !== "SOURCE.json"),
    )

    NodeAssert.deepEqual(source.files, files)
    NodeAssert.equal(source.contentSha256, sha256(JSON.stringify(files)))

    const build = JSON.parse(
      NodeFS.readFileSync(
        NodePath.join(destination, "dist/SOURCE.json"),
        "utf8",
      ),
    )

    NodeAssert.equal(source.sourceSha256, sha256(JSON.stringify(build.inputs)))

    assertBuildAssets(destination, build)

    const status = NodeChildProcess.execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: root, encoding: "utf8" },
    )

    NodeAssert.equal(
      source.commit,
      status === ""
        ? NodeChildProcess.execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: root,
            encoding: "utf8",
          }).trim()
        : null,
    )
    // Model a consumer with the declared peers installed in its node_modules.
    NodeFS.symlinkSync(
      NodePath.join(root, "node_modules"),
      NodePath.join(temporary, "node_modules"),
      "dir",
    )

    const config = await import(
      NodeURL.pathToFileURL(NodePath.join(destination, "dist/config.js"))
    )

    const plugin = await import(
      NodeURL.pathToFileURL(config.default.jsPlugins[0].specifier)
    )

    NodeAssert.ok(plugin.default.rules["no-unknown-parameters"])
    NodeAssert.equal(
      config.effectConfig.rules[
        "project-effect/no-service-constructor-imports"
      ],
      "error",
    )

    const [packed] = Object.values(
      JSON.parse(
        NodeChildProcess.execFileSync("npm", ["pack", "--dry-run", "--json"], {
          cwd: destination,
          encoding: "utf8",
        }),
      ),
    )

    NodeAssert.deepEqual(
      packed.files.map((file) => file.path).sort(),
      [...Object.keys(files), "SOURCE.json"].sort(),
    )
    NodeAssert.notEqual(runExporter(root, destination).status, 0)
    NodeAssert.deepEqual(
      NodeFS.readFileSync(NodePath.join(destination, "SOURCE.json")),
      Buffer.from(`${JSON.stringify(source, null, 2)}\n`),
    )
  },
)

NodeTest.test(
  "refuses changed build inputs, changed outputs, and modified upstream bytes",
  (context) => {
    const temporary = NodeFS.mkdtempSync(
      NodePath.join(NodeOS.tmpdir(), "lint-policy-integrity-"),
    )

    context.after(() =>
      NodeFS.rmSync(temporary, { recursive: true, force: true }),
    )
    const producer = NodePath.join(temporary, "producer")

    for (const entry of [
      "src",
      "scripts",
      "tools",
      "dist",
      "tsconfig.json",
      "package.json",
      "package-lock.json",
      "UPSTREAM-SOURCE.json",
      "LICENSE.anti-slop",
      "LICENSE.eslint-stylistic",
    ]) {
      NodeFS.cpSync(
        NodePath.join(root, entry),
        NodePath.join(producer, entry),
        { recursive: true },
      )
    }

    const destination = NodePath.join(temporary, "snapshot")

    for (const [file, expected] of [
      ["src/config.ts", "Build inputs changed"],
      ["dist/config.js", "Compiled output changed"],
      [
        "dist/vendor/anti-slop/src/vendor/eslint-stylistic/padding-line-options.d.ts",
        "Compiled output changed",
      ],
      [
        "dist/vendor/anti-slop/src/vendor/eslint-stylistic/LICENSE",
        "Compiled output changed",
      ],
      ["LICENSE.eslint-stylistic", "ESLint Stylistic license differs"],
      [
        "src/vendor/anti-slop/src/rules/no-array-filter-map.ts",
        "Upstream integrity mismatch",
      ],
    ]) {
      const path = NodePath.join(producer, file)
      const original = NodeFS.readFileSync(path)
      NodeFS.appendFileSync(path, "\n// changed\n")
      const result = runExporter(producer, destination)
      NodeAssert.notEqual(result.status, 0)
      NodeAssert.ok(result.stderr.includes(expected), result.stderr)
      NodeAssert.equal(NodeFS.existsSync(destination), false)
      NodeFS.writeFileSync(path, original)
    }
  },
)
