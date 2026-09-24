import * as NodeAssert from "node:assert"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeModule from "node:module"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"

import strictestConfig from "../dist/config.js"

const require = NodeModule.createRequire(import.meta.url)

const oxlintBin = NodePath.join(
  NodePath.dirname(require.resolve("oxlint/package.json")),
  "bin",
  "oxlint",
)

const typedRules = [
  "no-floating-promises",
  "no-misused-promises",
  "await-thenable",
  "switch-exhaustiveness-check",
]

NodeTest.test(
  "the default policy checks promise ownership and typed control flow",
  (context) => {
    const directory = NodeFS.mkdtempSync(
      NodePath.join(NodeOS.tmpdir(), "oxlint-typed-policy-"),
    )

    context.after(() =>
      NodeFS.rmSync(directory, { recursive: true, force: true }),
    )
    NodeFS.writeFileSync(
      NodePath.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, target: "ES2024" },
        include: ["*.ts"],
      }),
    )
    const configPath = NodePath.join(directory, ".oxlintrc.json")
    NodeFS.writeFileSync(
      configPath,
      JSON.stringify({
        categories: { correctness: "off" },
        plugins: ["typescript"],
        options: strictestConfig.options,
        rules: Object.fromEntries(
          typedRules.map((name) => [
            `typescript/${name}`,
            strictestConfig.rules[`typescript/${name}`],
          ]),
        ),
      }),
    )
    const sourcePath = NodePath.join(directory, "fixture.ts")

    function lint(source) {
      NodeFS.writeFileSync(sourcePath, source)

      return NodeChildProcess.spawnSync(
        process.execPath,
        [oxlintBin, "--config", configPath, "--format", "json", sourcePath],
        { cwd: directory, encoding: "utf8" },
      )
    }

    const rejected = lint(`
export async function broken(value: "ready" | "done") {
  void Promise.resolve(1)
  if (Promise.resolve(true)) return 1
  await 1
  switch (value) {
    case "ready": return 2
  }
  return 3
}
`)

    NodeAssert.strict.equal(
      rejected.status,
      1,
      `${rejected.stdout}${rejected.stderr}`,
    )
    const diagnostics = JSON.parse(rejected.stdout).diagnostics
    NodeAssert.strict.deepEqual(
      diagnostics.map((diagnostic) => diagnostic.code).sort(),
      typedRules.map((name) => `typescript(${name})`).sort(),
    )

    const accepted = lint(`
export async function owned(value: "ready" | "done") {
  await Promise.resolve(1)
  if (await Promise.resolve(true)) return 1
  switch (value) {
    case "ready": return 2
    case "done": return 3
  }
}
`)

    NodeAssert.strict.equal(
      accepted.status,
      0,
      `${accepted.stdout}${accepted.stderr}`,
    )
  },
)
