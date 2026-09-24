import * as NodeAssert from "node:assert/strict"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeModule from "node:module"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"
import { root } from "../scripts/integrity.mjs"
import { effectConfig } from "../dist/config.js"

const require = NodeModule.createRequire(import.meta.url)

const oxlint = NodePath.join(
  NodePath.dirname(require.resolve("oxlint/package.json")),
  "bin/oxlint",
)

const oxfmt = NodePath.join(
  NodePath.dirname(require.resolve("oxfmt/package.json")),
  "bin/oxfmt",
)

NodeTest.test(
  "compiled spacing rule fixes multiple files without moving attached comments",
  (context) => {
    const directory = NodeFS.mkdtempSync(
      NodePath.join(NodeOS.tmpdir(), "policy-spacing-"),
    )

    context.after(() =>
      NodeFS.rmSync(directory, { recursive: true, force: true }),
    )
    const config = NodePath.join(directory, "oxlint.json")
    const first = NodePath.join(directory, "first.ts")
    const second = NodePath.join(directory, "second.ts")
    NodeFS.writeFileSync(
      config,
      JSON.stringify({
        jsPlugins: [
          {
            name: "project",
            specifier: NodePath.join(root, "dist/plugin/index.js"),
          },
        ],
        rules: { "project/require-readable-spacing": "error" },
      }),
    )
    NodeFS.writeFileSync(
      first,
      "export const a = 1;\n/** Attached to b. */\nexport const b = 2;\n",
    )
    NodeFS.writeFileSync(
      second,
      "export function f() {\nconst a = 1;\nconst b = 2;\nreturn a + b;\n}\n",
    )

    const run = (...args) =>
      NodeChildProcess.spawnSync(
        process.execPath,
        [oxlint, "--config", config, ...args, first, second],
        { encoding: "utf8", cwd: directory },
      )

    const rejected = run()
    NodeAssert.equal(rejected.status, 1, rejected.stdout + rejected.stderr)
    NodeAssert.match(rejected.stdout, /require-readable-spacing/u)
    const fixed = run("--fix")
    NodeAssert.equal(fixed.status, 0, fixed.stdout + fixed.stderr)

    const expected = [
      "export const a = 1;\n\n/** Attached to b. */\nexport const b = 2;\n",
      "export function f() {\nconst a = 1;\nconst b = 2;\n\nreturn a + b;\n}\n",
    ]

    const contents = () =>
      [first, second].map((file) => NodeFS.readFileSync(file, "utf8"))

    NodeAssert.deepEqual(contents(), expected)

    for (const args of [[], ["--fix"]]) {
      const stable = run(...args)
      NodeAssert.equal(stable.status, 0, stable.stdout + stable.stderr)
      NodeAssert.deepEqual(contents(), expected)
    }

    const format = (mode) =>
      NodeChildProcess.spawnSync(
        process.execPath,
        [
          oxfmt,
          mode,
          "--config",
          NodePath.join(root, ".oxfmtrc.json"),
          first,
          second,
        ],
        { encoding: "utf8", cwd: directory },
      )

    const formatted = format("--write")
    NodeAssert.equal(formatted.status, 0, formatted.stdout + formatted.stderr)
    const formattedContents = contents()
    const fixedAgain = run("--fix")
    NodeAssert.equal(
      fixedAgain.status,
      0,
      fixedAgain.stdout + fixedAgain.stderr,
    )
    NodeAssert.deepEqual(contents(), formattedContents)
    const formatCheck = format("--check")
    NodeAssert.equal(
      formatCheck.status,
      0,
      formatCheck.stdout + formatCheck.stderr,
    )
  },
)

NodeTest.test(
  "Effect catch tagging diagnostics take precedence over competing Match advice",
  (context) => {
    const directory = NodeFS.mkdtempSync(
      NodePath.join(NodeOS.tmpdir(), "policy-effect-"),
    )

    context.after(() =>
      NodeFS.rmSync(directory, { recursive: true, force: true }),
    )
    const config = NodePath.join(directory, "oxlint.json")
    const source = NodePath.join(directory, "fixture.ts")
    NodeFS.writeFileSync(config, JSON.stringify(effectConfig))

    function lint(code) {
      NodeFS.writeFileSync(source, code)

      return NodeChildProcess.spawnSync(
        process.execPath,
        [oxlint, "--config", config, source],
        { encoding: "utf8", cwd: directory },
      )
    }

    const result = lint(
      'Effect.catchAll(error => error._tag === "A" ? a : error._tag === "B" ? b : c);\n',
    )

    NodeAssert.equal(result.status, 1, result.stdout + result.stderr)
    NodeAssert.match(result.stdout, /no-manual-effect-error-tag/u)
    NodeAssert.doesNotMatch(
      result.stdout,
      /prefer-effect-match|no-manual-tag-comparison/u,
    )

    const nested = lint(`Effect.catchAll(error => {
      function label(value) {
        switch (value._tag) { case "C": return c; }
        return value._tag === "A" ? a : value._tag === "B" ? b : d;
      }
      return recover(error, label(state));
    });`)

    NodeAssert.equal(nested.status, 1, nested.stdout + nested.stderr)
    NodeAssert.match(nested.stdout, /no-manual-tag-comparison/u)
    NodeAssert.match(nested.stdout, /prefer-effect-match/u)
    NodeAssert.doesNotMatch(nested.stdout, /no-manual-effect-error-tag/u)
  },
)
