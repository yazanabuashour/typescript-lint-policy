import * as NodeTest from "node:test"
import { RuleTester } from "oxlint/plugins-dev"

RuleTester.describe = NodeTest.describe

RuleTester.it = NodeTest.it

export const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
})
