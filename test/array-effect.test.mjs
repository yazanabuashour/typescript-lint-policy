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
    "const users = []; users.values().map(email).filter(Boolean).toArray();",
    "const users = []; users.flatMap(user => user.active ? [user.email] : []);",
    "const users = []; function collect(users) { return users.filter(active).map(email); }",
    "let users = []; users = iterator; users.filter(active).map(email);",
    "const first = second; const second = first; first.filter(active).map(email);",
  ],
  invalid: [
    "const users = []; const alias = users; alias.filter(active).map(email);",
    "function collect(users: readonly User[]) { return users.map(email).filter(Boolean); }",
    "const users = [] as const; users['filter'](active)['map'](email);",
    "const users = []; users.slice().filter(active).map(email);",
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
      "items.reduce((acc, item) => Object.assign(acc, item), {});",
      "items.reduce((acc, item) => acc.concat(item), '');",
      "items.reduce((acc, item) => acc.concat(item), customCollection);",
      "items.reduce((acc, item) => { const copy = () => Object.assign({}, acc); return acc; }, {});",
      "function run(Object) { return items.reduce((acc, item) => Object.assign({}, acc), {}); }",
      "items.reduce((acc, item) => { let alias = acc; alias = item; return Object.assign({}, alias); }, {});",
      "items.reduce((acc, item) => [...acc, item], []);",
    ],
    invalid: [
      "items.reduceRight((acc, item, index) => Object.assign({}, acc, item), {});",
      "items.reduce((acc, item) => { const alias = acc; return Object.assign({}, alias, item); }, {});",
      "items.reduce((acc, item) => { const next = acc.slice(); next.push(item); return next; }, []);",
      "const initial = []; items.reduce((acc, item) => acc.concat(item), initial);",
      "items.reduce((acc, item) => Array.from(acc), []);",
      ...["toSpliced", "toSorted", "toReversed", "with"].map(
        (method) => `items.reduce((acc, item) => acc.${method}(0, item), []);`,
      ),
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
      {
        filename: "service.spec.tsx",
        code: 'import { makeService } from "../service";',
      },
      'import { makeService } from "package";',
      'import { makeService } from "@/service";',
      'import makeService from "./service";',
      'import { serviceLayer } from "./service"; WorkspaceName.make("name");',
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
