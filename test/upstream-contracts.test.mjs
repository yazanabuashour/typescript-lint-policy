import plugin from "../dist/plugin/index.js"
import { tester } from "./rule-tester.mjs"

function check(name, messageId, valid, invalid) {
  tester.run(`project/${name}`, plugin.rules[name], {
    valid,
    invalid: invalid.map((code) => ({
      code,
      errors: [{ messageId }],
      output: null,
    })),
  })
}

check(
  "no-chained-type-assertions",
  "chained",
  ["const value = ({ id: 1 } as const) as const;"],
  [
    "const value = (input as unknown) as User;",
    "const value = <User>(<unknown>input);",
  ],
)

check(
  "no-conditional-empty-object-spread",
  "avoid",
  ["const result = condition ? { value } : {};"],
  [
    "const result = { ...(condition ? { value } : {}) };",
    "const result = { ...(condition ? {} : { value }) };",
  ],
)

check(
  "no-shape-in-symbol-names",
  "forbiddenSymbolName",
  ["schema.shape.id.parse(input);"],
  ["interface UserShape { id: string }", "type User = { shape: string };"],
)

check(
  "no-module-mocking",
  "moduleMock",
  ["function check(vi) { vi.mock('local'); }"],
  [
    "import { vi as api } from 'vitest'; api['mock']('store');",
    "jest.unstable_mockModule('store');",
  ],
)

for (const method of ["get", "apply"]) {
  check(
    `no-reflect-${method}`,
    method === "get" ? "reflectGet" : "reflectApply",
    [`function check(Reflect) { Reflect.${method}(owner, key); }`],
    [`Reflect['${method}'](owner, key);`],
  )
}

check(
  "no-object-parameters",
  "objectParameter",
  [
    "type Alias = object; function consume<Alias>(value: Alias) {}",
    "type Alias = object; function outer() { type Alias = User; function consume(value: Alias) {} }",
    "type Item = object; type F<T> = T extends infer Item ? (value: Item) => void : never;",
    "type T = string; type Concrete = T; type Wrapped<T> = Concrete; function consume(value: Wrapped<object>) {}",
    "type T = object; type Wrapped<T> = T; function outer<T>() { function consume(value: Wrapped<T>) {} }",
    "type Input = object; const Constructor = class Input { consume(value: Input) {} };",
    "type Input = object; function outer() { class Input {} function consume(value: Input) {} }",
    "type Loop<T> = Loop<T>; function consume(value: Loop<object>) {}",
  ],
  [
    "function outer() { function consume(value: Alias) {} type Alias = object; }",
    "type Identity<T> = T; type Wrapped<T> = Identity<T>; function consume(value: Wrapped<object>) {}",
    "type Item = object; type F<T> = T extends infer Item ? string : (value: Item) => void;",
    "type T = object; type Concrete = T; type Wrapped<T> = Concrete; function consume(value: Wrapped<string>) {}",
    "type Identity<T> = T; function consume(value: Identity<Identity<object>>) {}",
    "type Identity<T> = T; type Wrapped<T, U = Identity<T>> = U; function consume(value: Wrapped<object>) {}",
    "function outer<T>() { { type T = object; type Wrapped<U> = T; function consume(value: Wrapped<string>) {} } }",
    "type Input = object; const Constructor = class Input {}; function consume(value: Input) {}",
  ],
)

check(
  "no-unknown-parameters",
  "unknownParameter",
  [
    "function enrich(cause: unknown) {}",
    "function guard(value: unknown): value is User { return true; }",
    "function guard(value: unknown): asserts value is User {}",
    "type Input = unknown; function consume<Input>(value: Input) {}",
    "type T = string; type Concrete = T; type Wrapped<T> = Concrete; function consume(value: Wrapped<unknown>) {}",
    "type T = unknown; type Wrapped<T> = T; function outer<T>() { function consume(value: Wrapped<T>) {} }",
    "type Input = unknown; const Constructor = class Input { consume(value: Input) {} };",
  ],
  [
    "function guard(value: unknown, context: unknown): value is User { return true; }",
    "type Input = unknown; function consume(value: Input) {}",
    "function outer() { type Identity<T> = T; function consume(value: Identity<unknown>) {} }",
    "function consume({ value }: unknown = {}) {}",
    "type T = unknown; type Concrete = T; type Wrapped<T> = Concrete; function consume(value: Wrapped<string>) {}",
    "type Identity<T> = T; function consume(value: Identity<Identity<unknown>>) {}",
    "type Loop<T> = Loop<T> | T; function consume(value: Loop<unknown>) {}",
    "type Identity<T> = T; function outer() { type Identity = unknown; type Wrapped<T> = T; function consume(value: Wrapped<Identity>) {} }",
    "type Input = unknown; const Constructor = class Input {}; function consume(value: Input) {}",
  ],
)

check(
  "no-unknown-returns",
  "unknownReturn",
  [
    "type Value = unknown; function load<Value>(): Value { return input; }",
    "type Value = unknown; function outer() { type Value = User; function load(): Value { return input; } }",
    "type T = string; type Concrete = T; type Wrapped<T> = Concrete; function load(): Wrapped<unknown> { return input; }",
  ],
  [
    "function outer() { function load(): Value { return input; } type Value = unknown; }",
    "type Identity<T> = T; type Wrapped<T> = PromiseLike<Identity<T>>; function load(): Wrapped<unknown> { return input; }",
    "type Identity<T> = T; function load(): Identity<Identity<unknown>> { return input; }",
    "type Input = unknown; const Constructor = class Input {}; function load(): Input { return input; }",
  ],
)

check(
  "no-unknown-type-aliases",
  "unknownAlias",
  [
    "type Box<T> = { value: T }; type Payload = Box<unknown>;",
    "type A = B; type B = A;",
    "type Loop<T> = Loop<T>; type Payload = Loop<unknown>;",
    "type A<T> = B<T>; type B<T> = A<T>; type Payload = A<unknown>;",
    "type Identity<T> = T; type Loop<T> = Identity<Loop<T>>; type Payload = Loop<unknown>;",
    "type T = string; type Concrete = T; type Wrapped<T> = Concrete; type Payload = Wrapped<unknown>;",
  ],
  [
    "function outer() { type Payload = unknown; }",
    "type Identity<T> = T; type Wrapped<T> = Identity<T>; type Payload = Wrapped<unknown>;",
    "type Identity<T> = T; type Payload = Identity<Identity<unknown>>;",
  ],
)

check(
  "no-unsafe-dictionary-type",
  "unsafeDictionary",
  [
    "type WithSchema<T extends Readonly<Record<string, unknown>>> = T;",
    "type Wrapped<T> = { value: T }; type Safe = Record<string, Wrapped<unknown>>;",
    "interface User { id: string } type Safe = Record<string, unknown & User>;",
  ],
  [
    "type WithSchema<T = Record<string, unknown>> = T;",
    "type Identity<T> = T; type Unsafe = Record<string, Identity<unknown>>;",
    "function local() { type Record<K,V> = { key: K; value: V }; type Safe = Record<string, unknown>; } function other() { type Unsafe = Record<string, unknown>; }",
    "interface Empty { brand?: never } type Unsafe = Record<string, Empty>;",
  ],
)

check(
  "no-known-value-widening",
  "widening",
  [
    "const index: Record<string, number> = {};",
    "type Key = 'a' | 'b'; const index: Record<Key, number> = { a: 1, b: 2 };",
    "type Index<K extends PropertyKey, V> = Record<K, V>; const index: Index<'a', number> = { a: 1 };",
    "const index = { a: 1 } satisfies Record<string, number>;",
    "function guard(value: unknown): value is User { return true; } declare const input: unknown; guard(input);",
  ],
  [
    "function outer() { type Index = Record<string, number>; const index: Index = { a: 1 }; }",
    "type Key = string; const index: Record<Key | 'a', number> = { a: 1 };",
    "type Identity<T> = T; const index: Identity<Record<string, number>> = { a: 1 };",
    "function guard(value: unknown): value is User { return true; } guard({ id: 1 });",
    "const guard = (value: unknown): value is User => true; declare const user: User; guard(user);",
    "function guard(value: unknown): value is User { return true; } function load(): User { return user; } guard(load());",
  ],
)

check(
  "no-widen-then-assert",
  "widenThenAssert",
  [
    "declare const input: unknown; const user = input as User;",
    "const known = { id: 1 }; let widened: unknown = known; widened = input; const user = widened as User;",
  ],
  [
    "const known = { id: 1 }; const widened: unknown = known; const user = widened as User;",
  ],
)

const typeGuardOptions = [{ allowInTypeGuards: true }]

tester.run("project/no-runtime-typeof", plugin.rules["no-runtime-typeof"], {
  valid: [
    'typeof document === "undefined";',
    '"undefined" != typeof globalThis.crypto;',
    {
      code: 'function guard(value: unknown): value is string { return typeof value === "string"; }',
      options: typeGuardOptions,
    },
    {
      code: 'function guard(value: unknown): asserts value is string { if (typeof value !== "string") throw Error(); }',
      options: typeGuardOptions,
    },
  ],
  invalid: [
    {
      code: 'typeof value === "string";',
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      code: "typeof value === undefined;",
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      code: 'function guard(value: unknown): value is string { return typeof value === "string"; }',
      errors: [{ messageId: "runtimeTypeof" }],
    },
    {
      code: 'function guard(value: unknown): value is string { const nested = () => typeof value === "string"; return nested(); }',
      options: typeGuardOptions,
      errors: [{ messageId: "runtimeTypeof" }],
    },
  ],
})

tester.run(
  "project/require-safety-comment-for-type-assertion",
  plugin.rules["require-safety-comment-for-type-assertion"],
  {
    valid: [
      "const value = [1] as const;",
      "// SAFETY: The parser checked the identifier.\nexport const id = value as UserId;",
      "/* SAFETY:\n * The parser checked the identifier.\n */\nexport const id = value as UserId;",
      {
        code: "// SAFE+: The parser checked the identifier.\nconst id = value as UserId;",
        options: [{ markers: ["SAFE+"] }],
      },
    ],
    invalid: [
      {
        code: "/* SAFETY:\n *\n */\nconst id = value as UserId;",
        errors: [{ messageId: "missingSafetyComment" }],
      },
      {
        code: "// SAFETY:   \nconst id = value as UserId;",
        errors: [{ messageId: "missingSafetyComment" }],
      },
      {
        code: "const id = value as UserId; // SAFETY: Too late.",
        errors: [{ messageId: "missingSafetyComment" }],
      },
      {
        code: "// SAFETY: Not configured.\nconst id = value as UserId;",
        options: [{ markers: ["INVARIANT"] }],
        errors: [{ messageId: "missingSafetyComment" }],
      },
    ],
  },
)
