import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeCrypto from "node:crypto"
import * as NodeFS from "node:fs"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"
import * as NodeURL from "node:url"

const root = NodeURL.fileURLToPath(new URL("../", import.meta.url))

function sha256(bytes) {
  return NodeCrypto.createHash("sha256").update(bytes).digest("hex")
}

function snapshotFiles(directory) {
  return Object.fromEntries(
    NodeFS.readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        NodePath.relative(
          directory,
          NodePath.join(entry.parentPath, entry.name),
        ),
      )
      .sort()
      .map((file) => [
        file,
        sha256(NodeFS.readFileSync(NodePath.join(directory, file))),
      ]),
  )
}

function runExporter(producer, destination) {
  return NodeChildProcess.spawnSync(
    process.execPath,
    [NodePath.join(producer, "scripts/vendor.mjs"), destination],
    { encoding: "utf8" },
  )
}

function assertConsumerUsage(destination, directory, manifest) {
  for (const [name, source] of [
    [manifest.name, destination],
    ...Object.keys(manifest.peerDependencies).map((name) => [
      name,
      NodePath.join(root, "node_modules", name),
    ]),
  ]) {
    const dependency = NodePath.join(directory, "node_modules", name)
    NodeFS.mkdirSync(NodePath.dirname(dependency), { recursive: true })
    NodeFS.symlinkSync(source, dependency, "dir")
  }

  NodeFS.writeFileSync(
    NodePath.join(directory, "package.json"),
    '{"type":"module"}',
  )
  const configPath = NodePath.join(directory, "oxlint.config.ts")
  NodeFS.writeFileSync(
    configPath,
    `import policy, { effectConfig } from "@yazanabuashour/oxlint-config"
import { defineConfig } from "oxlint"
export default defineConfig({ extends: [policy, effectConfig] })
`,
  )
  NodeFS.writeFileSync(
    NodePath.join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: "NodeNext",
        target: "ES2024",
        types: [],
      },
      include: ["oxlint.config.ts"],
    }),
  )
  NodeChildProcess.execFileSync(
    NodePath.join(root, "node_modules/.bin/tsc"),
    ["--noEmit", "-p", NodePath.join(directory, "tsconfig.json")],
    { encoding: "utf8" },
  )

  const sourcePath = NodePath.join(directory, "fixture.ts")

  const lint = (source) => {
    NodeFS.writeFileSync(sourcePath, source)

    return NodeChildProcess.spawnSync(
      NodePath.join(root, "node_modules/.bin/oxlint"),
      ["--config", configPath, sourcePath],
      { cwd: directory, encoding: "utf8" },
    )
  }

  const rejected = lint(
    'import { makeService } from "./service";\nexport const value = Reflect.get({}, "value");\nexport const service = makeService(value);\n',
  )

  NodeAssert.equal(rejected.status, 1, rejected.stdout + rejected.stderr)
  NodeAssert.match(rejected.stdout, /no-reflect-get/u)
  NodeAssert.match(rejected.stdout, /no-service-constructor-imports/u)

  const accepted = lint("export const value = 1;\n")
  NodeAssert.equal(accepted.status, 0, accepted.stdout + accepted.stderr)
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
  (context) => {
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

    const files = snapshotFiles(destination)
    delete files["SOURCE.json"]

    NodeAssert.deepEqual(source.files, files)
    NodeAssert.equal(source.contentSha256, sha256(JSON.stringify(files)))

    const build = JSON.parse(
      NodeFS.readFileSync(
        NodePath.join(destination, "dist/SOURCE.json"),
        "utf8",
      ),
    )

    NodeAssert.equal(source.sourceSha256, sha256(JSON.stringify(build.inputs)))
    NodeAssert.deepEqual(
      Object.fromEntries(
        Object.entries(files)
          .filter(
            ([file]) => file.startsWith("dist/") && file !== "dist/SOURCE.json",
          )
          .map(([file, digest]) => [file.slice("dist/".length), digest]),
      ),
      build.outputs,
    )

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
    assertConsumerUsage(destination, temporary, manifest)

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
    const beforeRefusal = snapshotFiles(destination)
    const refused = runExporter(root, destination)
    NodeAssert.equal(refused.status, 1, refused.stdout + refused.stderr)
    NodeAssert.match(refused.stderr, /Destination must not exist/u)
    NodeAssert.deepEqual(snapshotFiles(destination), beforeRefusal)
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
      NodeAssert.equal(result.status, 1, result.stdout + result.stderr)
      NodeAssert.ok(result.stderr.includes(expected), result.stderr)
      NodeAssert.equal(NodeFS.existsSync(destination), false)
      NodeFS.writeFileSync(path, original)
    }
  },
)
