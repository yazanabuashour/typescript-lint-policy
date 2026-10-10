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
import { tester } from "./rule-tester.mjs"

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

    NodeAssert.strict.ok(strictestConfig.plugins?.includes("jsx-a11y"))
    NodeAssert.strict.equal(
      strictestConfig.rules?.["react/exhaustive-deps"],
      "error",
    )
    NodeAssert.strict.equal(
      strictestConfig.rules?.["react/rules-of-hooks"],
      "error",
    )
    NodeAssert.strict.equal(
      strictestConfig.rules?.["typescript/no-explicit-any"],
      "error",
    )
    NodeAssert.strict.equal(
      strictestConfig.rules?.["typescript/no-non-null-assertion"],
      "error",
    )
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

tester.run(
  "project/no-multiline-comments",
  plugin.rules["no-multiline-comments"],
  {
    valid: [
      "// SAFETY: The parser checked this invariant.\nconst id = input as UserId;",
      "/* One line. */\nconst value = 1; // Another line.\nconst text = `// not a comment\\n/* neither */`;",
      "// First decision.\n\n// Separate decision.\nconst value = 1;",
      "// First decision.\n// @ts-check\n// Second decision.\nconst value = 1;",
      "/** Public contract.\n * A second line.\n */\nexport function publicApi() {}",
      "/** Public contract.\n * A second line.\n */\nexport default class { /** Member contract.\n * More detail.\n */ method() {} }",
      "export interface PublicApi { /** Member contract.\n * More detail.\n */ method(): void }\nexport type Shape = { /** Field contract.\n * More detail.\n */ value: number };",
      "export enum State { /** Public variant.\n * More detail.\n */ Ready }\nexport namespace Api { /** Public contract.\n * More detail.\n */ export function run() {} }",
      "export /** Public contract.\n * More detail.\n */ const publicValue = 1;",
      "#!/usr/bin/env node\n/* eslint-disable no-console,\n no-debugger */\nconsole.log('ok');\ndebugger;",
      "/* Copyright Example Authors.\n * Redistribution permitted under MIT.\n */\n// SPDX-License-Identifier: MIT\n// A required legal notice.\nconst value = 1;",
    ],
    invalid: [
      {
        code: "// One line.\n// Another line.\nconst value = 1;",
        errors: [{ messageId: "multiline" }],
      },
      {
        code: "/* One sentence\n */\nconst value = 1;",
        errors: [{ messageId: "multiline" }],
      },
      {
        code: "/** Internal detail.\n * More detail.\n */\nfunction internal() {}\nexport { internal };",
        errors: [{ messageId: "multiline" }],
      },
      {
        code: "/** Not API documentation.\n * More detail.\n */\nexport { value } from './other';",
        errors: [{ messageId: "multiline" }],
      },
      {
        code: "/* Not a doc comment.\n * More detail.\n */\nexport function publicApi() {}",
        errors: [{ messageId: "multiline" }],
      },
      {
        code: "export class PublicApi { /** Private detail.\n * More detail.\n */ private method() {} }",
        errors: [{ messageId: "multiline" }],
      },
      {
        code: "export function publicApi() { /** Internal detail.\n * More detail.\n */ const value = 1; }",
        errors: [{ messageId: "multiline" }],
      },
      {
        code: "// @ts-check\n// First decision.\n// Second decision.\nconst value = 1;",
        errors: [{ messageId: "multiline", line: 2, endLine: 3 }],
      },
    ],
  },
)

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
  const result = runRule(
    "project/no-inline-schema-compile",
    "const User = Schema.Struct({ name: Schema.String })\nexport const parse = (input) => Schema.decodeUnknownEffect(User)(input)\n",
  )

  NodeAssert.strict.equal(result.status, 1, `${result.stdout}${result.stderr}`)
  NodeAssert.strict.match(`${result.stdout}${result.stderr}`, /Hoist Schema/u)
})

NodeTest.test("rejects manual Effect runtimes in tests", () => {
  const result = runRule(
    "project/no-manual-effect-runtime-in-tests",
    "test('effect', () => Effect.runPromise(Effect.void))\n",
    "fixture.test.ts",
  )

  NodeAssert.strict.equal(result.status, 1, `${result.stdout}${result.stderr}`)
  NodeAssert.strict.match(
    `${result.stdout}${result.stderr}`,
    /@effect\/vitest/u,
  )
})
