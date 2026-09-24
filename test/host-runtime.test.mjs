import plugin from "../dist/plugin/index.js"
import { tester } from "./rule-tester.mjs"

tester.run(
  "project/no-global-process-runtime",
  plugin.rules["no-global-process-runtime"],
  {
    valid: [
      'import * as NodeOS from "node:os"; function read(NodeOS) { return NodeOS.platform(); }',
      'import NodeOS from "os"; function read(NodeOS) { return NodeOS.arch(); }',
      'import { platform as hostPlatform } from "node:os"; function read(hostPlatform) { return hostPlatform(); }',
      'import type * as NodeOS from "node:os"; NodeOS.platform();',
      'import type { platform } from "node:os"; platform();',
      'import { type arch } from "os"; arch();',
    ],
    invalid: [
      {
        code: 'import * as NodeOS from "node:os"; function read(NodeOS) { return NodeOS.platform(); } NodeOS.platform();',
        errors: [
          {
            message:
              "Inject a project-owned host platform contract instead of reading process.platform directly.",
          },
        ],
      },
      {
        code: 'import NodeOS from "os"; function read(NodeOS) { return NodeOS.arch(); } NodeOS.arch();',
        errors: [
          {
            message:
              "Inject a project-owned host arch contract instead of reading process.arch directly.",
          },
        ],
      },
      {
        code: 'import { platform as hostPlatform, type arch } from "node:os"; function read(hostPlatform) { return hostPlatform(); } hostPlatform(); arch();',
        errors: [
          {
            message:
              "Inject a project-owned host platform contract instead of reading process.platform directly.",
          },
        ],
      },
    ],
  },
)
