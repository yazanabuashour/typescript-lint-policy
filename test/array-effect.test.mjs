import effectPlugin from "../dist/plugin/effect/index.js"
import plugin from "../dist/plugin/index.js"
import { tester } from "./rule-tester.mjs"

for (const [rule, messageId, code] of [
  [
    "no-manual-effect-error-tag",
    "tag",
    'Effect.catchAll(error => error._tag === "NotFound" ? recover : fail);',
  ],
  ["no-manual-tag-comparison", "manualComparison", 'value._tag === "Ready";'],
  [
    "no-manual-tagged-construction",
    "manualConstruction",
    'const value = { _tag: "Ready" };',
  ],
]) {
  tester.run(`project-effect/${rule}`, effectPlugin.rules[rule], {
    valid: [],
    invalid: [{ code, errors: [{ messageId }], output: null }],
  })
}

tester.run(
  "project-effect/prefer-effect-match",
  effectPlugin.rules["prefer-effect-match"],
  {
    valid: [
      'Effect.catchAll(error => error._tag === "A" ? a : error._tag === "B" ? b : c);',
      'Effect.catch(error => error.reason["_tag"] === "A" ? a : error.reason["_tag"] === "B" ? b : c);',
      'Effect.catchIf(predicate, error => "A" === error._tag ? a : "B" === error._tag ? b : c);',
    ],
    invalid: [
      'const result = value === "A" ? a : value === "B" ? b : c;',
      'const result = value._tag === "A" ? a : value._tag === "B" ? b : c;',
      'Effect.catchAll(error => error.status === "A" ? a : error.status === "B" ? b : c);',
      'Effect.catchAll(error => { const nested = () => error._tag === "A" ? a : error._tag === "B" ? b : c; return nested(); });',
      'Effect.catchAll(error => { function label(value) { return value._tag === "A" ? a : value._tag === "B" ? b : c; } return recover(label(state)); });',
    ].map((code) => ({
      code,
      errors: [{ messageId: "preferMatch" }],
      output: null,
    })),
  },
)

tester.run("project/no-array-filter-map", plugin.rules["no-array-filter-map"], {
  valid: [
    "const users = []; users.values().filter(active).map(email).toArray();",
  ],
  invalid: [
    "const users = []; const alias = users; alias.filter(active).map(email);",
  ].map((code) => ({
    code,
    errors: [{ messageId: "arrayFilterMap" }],
    output: null,
  })),
})

tester.run(
  "project/no-reduce-accumulator-copy",
  plugin.rules["no-reduce-accumulator-copy"],
  {
    valid: [
      "items.reduce((acc, item) => { acc.push(item); return acc; }, []);",
      "items.reduce((acc, item) => [...acc, item], []);",
    ],
    invalid: [
      "items.reduce((acc, item) => { const alias = acc; return Object.assign({}, alias, item); }, {});",
    ].map((code) => ({
      code,
      errors: [{ messageId: "accumulatorCopy" }],
      output: null,
    })),
  },
)

tester.run(
  "project-effect/no-service-constructor-imports",
  effectPlugin.rules["no-service-constructor-imports"],
  {
    valid: [
      {
        filename: "service.test.ts",
        code: 'import { makeService } from "./service";',
      },
      'import { makeService } from "package";',
      'import { makeService } from "@/service";',
      'import makeService from "./service";',
    ],
    invalid: ['import { makeService as createService } from "../service";'].map(
      (code) => ({
        code,
        errors: [{ messageId: "serviceConstructorImport" }],
        output: null,
      }),
    ),
  },
)
