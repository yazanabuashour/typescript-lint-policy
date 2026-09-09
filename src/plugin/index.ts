import { definePlugin } from "@oxlint/plugins"
import { noKnownValueWideningRule } from "./overrides/no-known-value-widening.ts"
import { noObjectParametersRule } from "./overrides/no-object-parameters.ts"
import { noRuntimeTypeofRule } from "./overrides/no-runtime-typeof.ts"
import { noUnknownParametersRule } from "./overrides/no-unknown-parameters.ts"
import { noUnknownReturnsRule } from "./overrides/no-unknown-returns.ts"
import { noUnknownTypeAliasesRule } from "./overrides/no-unknown-type-aliases.ts"
import { noUnsafeDictionaryTypeRule } from "./overrides/no-unsafe-dictionary-type.ts"
import { noWidenThenAssertRule } from "./overrides/no-widen-then-assert.ts"
import { requireSafetyCommentForTypeAssertionRule } from "./overrides/require-safety-comment-for-type-assertion.ts"
import { namespaceNodeImportsRule } from "./rules/namespace-node-imports.ts"
import { noGlobalProcessRuntimeRule } from "./rules/no-global-process-runtime.ts"
import { noInlineSchemaCompileRule } from "./rules/no-inline-schema-compile.ts"
import { noManualEffectRuntimeInTestsRule } from "./rules/no-manual-effect-runtime-in-tests.ts"
import { upstreamRules } from "./upstream.ts"

/** Keep consumer waiver names stable across upstream and local implementations. */
const projectRulesPlugin = definePlugin({
  meta: { name: "project" },
  rules: {
    ...upstreamRules,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-object-parameters": noObjectParametersRule,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-unknown-parameters": noUnknownParametersRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
    "no-widen-then-assert": noWidenThenAssertRule,
    "require-safety-comment-for-type-assertion":
      requireSafetyCommentForTypeAssertionRule,
    "namespace-node-imports": namespaceNodeImportsRule,
    "no-global-process-runtime": noGlobalProcessRuntimeRule,
    "no-inline-schema-compile": noInlineSchemaCompileRule,
    "no-manual-effect-runtime-in-tests": noManualEffectRuntimeInTestsRule,
  },
})

export default projectRulesPlugin
