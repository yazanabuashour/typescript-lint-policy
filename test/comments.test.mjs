import plugin from "../dist/plugin/index.js"
import { tester } from "./rule-tester.mjs"

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
      "/** Public contract.\n * A second line.\n */\nexport declare function publicApi(): void;",
      "export declare namespace Api { /** Public contract.\n * More detail.\n */ export function run(): void; }",
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
