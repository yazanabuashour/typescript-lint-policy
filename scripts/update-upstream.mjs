import * as NodeChildProcess from "node:child_process"
import * as NodeFS from "node:fs"
import { sha256 } from "./integrity.mjs"

const [checkout, revision, ...extra] = process.argv.slice(2)
if (!checkout || !/^[a-f0-9]{40}$/u.test(revision ?? "") || extra.length) {
  throw new Error(
    "Usage: npm run upstream:update -- <upstream-checkout> <full-commit>",
  )
}
const manifestURL = new URL("../UPSTREAM-SOURCE.json", import.meta.url)
const previous = JSON.parse(NodeFS.readFileSync(manifestURL, "utf8"))
const resolved = NodeChildProcess.execFileSync(
  "git",
  ["-C", checkout, "rev-parse", `${revision}^{commit}`],
  { encoding: "utf8" },
).trim()
if (resolved !== revision) throw new Error("Candidate must be an exact commit")
// Read Git objects, not checkout bytes: dirty candidate files cannot change the pin.
const files = Object.fromEntries(
  Object.keys(previous.files).map((file) => [
    file,
    NodeChildProcess.execFileSync("git", [
      "-C",
      checkout,
      "show",
      `${revision}:${file}`,
    ]),
  ]),
)
for (const [file, bytes] of Object.entries(files)) {
  NodeFS.writeFileSync(
    new URL(`../src/vendor/anti-slop/${file}`, import.meta.url),
    bytes,
  )
}
NodeFS.writeFileSync(
  new URL("../LICENSE.anti-slop", import.meta.url),
  files.LICENSE,
)
NodeFS.writeFileSync(
  manifestURL,
  `${JSON.stringify(
    {
      repository: previous.repository,
      revision,
      files: Object.fromEntries(
        Object.entries(files).map(([file, bytes]) => [file, sha256(bytes)]),
      ),
    },
    null,
    2,
  )}\n`,
)
console.log(
  `Staged anti-slop ${revision}; inspect the diff and run npm run check before review`,
)
