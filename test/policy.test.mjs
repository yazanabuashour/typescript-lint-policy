import * as NodeAssert from "node:assert"
import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import * as NodeModule from "node:module"
import * as NodeOS from "node:os"
import * as NodePath from "node:path"
import * as NodeTest from "node:test"
import * as NodeURL from "node:url"

import strictestConfig, { effectConfig } from "../dist/config.js"
import plugin from "../dist/plugin/index.js"
import effectPlugin from "../dist/plugin/effect/index.js"

const require = NodeModule.createRequire(import.meta.url)

const oxlintPackage = require.resolve("oxlint/package.json")

const oxlintBin = NodePath.join(
  NodePath.dirname(oxlintPackage),
  "bin",
  "oxlint",
)

const pluginPath = NodeURL.fileURLToPath(
  new URL("../dist/plugin/index.js", import.meta.url),
)

const fixtureDirectories = []

NodeTest.after(() => {
  for (const directory of fixtureDirectories) {
    NodeFS.rmSync(directory, { recursive: true, force: true })
  }
})

function runRule(rule, source, filename = "fixture.ts", options) {
  const fixtureDirectory = NodeFS.mkdtempSync(
    NodePath.join(NodeOS.tmpdir(), "oxlint-policy-"),
  )

  fixtureDirectories.push(fixtureDirectory)
  const configPath = NodePath.join(fixtureDirectory, ".oxlintrc.json")
  const sourcePath = NodePath.join(fixtureDirectory, filename)
  NodeFS.mkdirSync(NodePath.dirname(sourcePath), { recursive: true })
  NodeFS.writeFileSync(
    configPath,
    JSON.stringify({
      jsPlugins: rule.startsWith("project-effect/")
        ? effectConfig.jsPlugins
        : [{ name: "project", specifier: pluginPath }],
      options: strictestConfig.options,
      rules: { [rule]: options ?? "error" },
    }),
  )
  NodeFS.writeFileSync(sourcePath, source)

  return NodeChildProcess.spawnSync(
    process.execPath,
    [oxlintBin, "--config", configPath, sourcePath],
    {
      cwd: fixtureDirectory,
      encoding: "utf8",
    },
  )
}

NodeTest.test(
  "strictest policy enables every portable shared rule as an error",
  () => {
    NodeAssert.strict.deepEqual(strictestConfig.categories, {
      correctness: "error",
      perf: "error",
      suspicious: "error",
    })
    NodeAssert.strict.equal(
      strictestConfig.options.reportUnusedDisableDirectives,
      "error",
    )

    for (const name of Object.keys(plugin.rules)) {
      NodeAssert.strict.equal(strictestConfig.rules[`project/${name}`], "error")
    }

    NodeAssert.strict.equal(
      strictestConfig.rules["oxc/no-accumulating-spread"],
      "error",
    )

    for (const name of Object.keys(effectPlugin.rules)) {
      NodeAssert.strict.equal(
        strictestConfig.rules[`project-effect/${name}`],
        undefined,
      )
      NodeAssert.strict.equal(
        effectConfig.rules[`project-effect/${name}`],
        "error",
      )
    }

    NodeAssert.strict.deepEqual(strictestConfig.overrides, [
      {
        files: ["**/*.{spec,test}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
        rules: { "typescript/unbound-method": "off" },
      },
    ])

    NodeAssert.strict.ok(strictestConfig.plugins?.includes("jsx-a11y"))

    for (const name of [
      "react/exhaustive-deps",
      "react/rules-of-hooks",
      "typescript/no-explicit-any",
      "typescript/no-non-null-assertion",
    ]) {
      NodeAssert.strict.equal(strictestConfig.rules[name], "error", name)
    }
  },
)

NodeTest.test(
  "loads the optional Effect plugin through its exported configuration",
  () => {
    const result = runRule(
      "project-effect/no-service-constructor-imports",
      'import { makeService } from "./service";',
    )

    NodeAssert.strict.equal(
      result.status,
      1,
      `${result.stdout}${result.stderr}`,
    )
    NodeAssert.strict.match(
      `${result.stdout}${result.stderr}`,
      /Import the owning Layer/u,
    )
  },
)

NodeTest.test("rejects unused waivers without a consumer CLI flag", () => {
  const result = runRule(
    "project/no-reflect-get",
    "// oxlint-disable-next-line project/no-reflect-get\nexport const value = 1\n",
  )

  NodeAssert.strict.equal(result.status, 1, `${result.stdout}${result.stderr}`)
  NodeAssert.strict.match(
    `${result.stdout}${result.stderr}`,
    /Unused.*directive/iu,
  )
})

NodeTest.test("enforces the native accumulating-spread companion", () => {
  const result = runRule(
    "oxc/no-accumulating-spread",
    "items.reduce((acc, item) => [...acc, item], []);",
  )

  NodeAssert.strict.equal(result.status, 1, `${result.stdout}${result.stderr}`)
  NodeAssert.strict.match(
    `${result.stdout}${result.stderr}`,
    /no-accumulating-spread/u,
  )
})

NodeTest.test("requires canonical Node.js namespace imports", () => {
  const result = runRule(
    "project/namespace-node-imports",
    'import { readFile } from "node:fs/promises"\nvoid readFile\n',
  )

  NodeAssert.strict.equal(result.status, 1, `${result.stdout}${result.stderr}`)
  NodeAssert.strict.match(
    `${result.stdout}${result.stderr}`,
    /canonical alias NodeFSP/u,
  )
})

NodeTest.test("allows the callable node:test default import", () => {
  const result = runRule(
    "project/namespace-node-imports",
    'import NodeTest from "node:test"\nNodeTest("works", () => {})\n',
  )

  NodeAssert.strict.equal(result.status, 0, `${result.stdout}${result.stderr}`)
})

NodeTest.test("requires a host runtime adapter for platform reads", () => {
  const result = runRule(
    "project/no-global-process-runtime",
    "export const platform = process.platform\n",
  )

  NodeAssert.strict.equal(result.status, 1, `${result.stdout}${result.stderr}`)
  NodeAssert.strict.match(
    `${result.stdout}${result.stderr}`,
    /project-owned host platform/u,
  )
})

NodeTest.test("allows declared host runtime adapter files", () => {
  const result = runRule(
    "project/no-global-process-runtime",
    "export const platform = process.platform\n",
    "src/host-runtime.ts",
    ["error", { allowFiles: ["src/host-runtime.ts"] }],
  )

  NodeAssert.strict.equal(result.status, 0, `${result.stdout}${result.stderr}`)
})

NodeTest.test("allows injected process contracts", () => {
  const result = runRule(
    "project/no-global-process-runtime",
    "export const platform = (process) => process.platform\n",
  )

  NodeAssert.strict.equal(result.status, 0, `${result.stdout}${result.stderr}`)
})

NodeTest.test("allows injected globalThis contracts", () => {
  const result = runRule(
    "project/no-global-process-runtime",
    "export const platform = (globalThis) => globalThis.process.platform\n",
  )

  NodeAssert.strict.equal(result.status, 0, `${result.stdout}${result.stderr}`)
})

NodeTest.test("rejects inline Effect Schema compilation", () => {
  for (const compiled of [
    "Schema.decodeUnknownEffect(User)",
    "Schema['decodeUnknownEffect'](User)",
    "(Schema satisfies typeof Schema).decodeUnknownEffect(User)",
    "(Schema.decodeUnknownEffect(User) satisfies Decoder)",
    "(Schema.decodeUnknownEffect(User) as Decoder)",
  ]) {
    const result = runRule(
      "project/no-inline-schema-compile",
      `const User = Schema.Struct({ name: Schema.String })\nexport const parse = (input) => ${compiled}(input)\n`,
    )

    NodeAssert.strict.equal(
      result.status,
      1,
      `${result.stdout}${result.stderr}`,
    )
    NodeAssert.strict.match(
      `${result.stdout}${result.stderr}`,
      /Reuse Schema\.decodeUnknownEffect\(\.\.\.\) from the schema's owning scope: the compiled function is rebuilt on every call\./u,
    )
  }

  const dynamic = runRule(
    "project/no-inline-schema-compile",
    "export const parse = (schema, input) => Schema.decodeUnknownEffect(Schema.Array(schema))(input);",
  )

  NodeAssert.strict.equal(
    dynamic.status,
    1,
    `${dynamic.stdout}${dynamic.stderr}`,
  )
  NodeAssert.strict.match(
    `${dynamic.stdout}${dynamic.stderr}`,
    /Reuse Schema\.decodeUnknownEffect\(\.\.\.\) from the schema's owning scope: both the inline schema and its compiled function are rebuilt on every call\./u,
  )

  const computed = runRule(
    "project/no-inline-schema-compile",
    "const Schema = { wrap: schema => input => ({ schema, input }) }; const User = {}; const decodeSync = 'wrap'; export const parse = input => Schema[decodeSync](User)(input); export const parseNested = (input, factory) => Schema.decodeUnknownEffect(Schema[factory](input))(input);",
  )

  NodeAssert.strict.equal(
    computed.status,
    0,
    `${computed.stdout}${computed.stderr}`,
  )
})

NodeTest.test("rejects manual Effect runtimes in tests", () => {
  for (const callee of [
    "Effect.runPromise",
    "Effect['runPromise']",
    "(Effect satisfies typeof Effect).runPromise",
  ]) {
    const result = runRule(
      "project/no-manual-effect-runtime-in-tests",
      `test('effect', () => ${callee}(Effect.void))\n`,
      "fixture.test.ts",
    )

    NodeAssert.strict.equal(
      result.status,
      1,
      `${result.stdout}${result.stderr}`,
    )
    NodeAssert.strict.match(
      `${result.stdout}${result.stderr}`,
      /@effect\/vitest/u,
    )
  }

  const computed = runRule(
    "project/no-manual-effect-runtime-in-tests",
    "const runPromise = 'map'; test('effect', () => Effect[runPromise](Effect.void, value => value));",
    "fixture.test.ts",
  )

  NodeAssert.strict.equal(
    computed.status,
    0,
    `${computed.stdout}${computed.stderr}`,
  )
})
