import * as NodeAssert from "node:assert/strict"
import * as NodeCrypto from "node:crypto"
import * as NodeFS from "node:fs"
import * as NodePath from "node:path"

const root = new URL("../src/vendor/anti-slop/", import.meta.url)

const source = JSON.parse(
  NodeFS.readFileSync(
    new URL("../UPSTREAM-SOURCE.json", import.meta.url),
    "utf8",
  ),
)

const files = NodeFS.readdirSync(root, { recursive: true })
  .filter((path) => NodeFS.statSync(new URL(path, root)).isFile())
  .map((path) => path.split(NodePath.sep).join("/"))
  .sort()

NodeAssert.deepEqual(
  files,
  Object.keys(source.files).sort(),
  "Upstream file inventory changed",
)

for (const file of files) {
  const digest = NodeCrypto.createHash("sha256")
    .update(NodeFS.readFileSync(new URL(file, root)))
    .digest("hex")

  NodeAssert.equal(
    digest,
    source.files[file],
    `Upstream integrity mismatch: ${file}`,
  )
}

NodeAssert.deepEqual(
  NodeFS.readFileSync(new URL("LICENSE", root)),
  NodeFS.readFileSync(new URL("../LICENSE.anti-slop", import.meta.url)),
  "Upstream license differs from the distributed notice",
)

NodeAssert.deepEqual(
  NodeFS.readFileSync(new URL("src/vendor/eslint-stylistic/LICENSE", root)),
  NodeFS.readFileSync(new URL("../LICENSE.eslint-stylistic", import.meta.url)),
  "ESLint Stylistic license differs from the distributed notice",
)

console.log(`Verified anti-slop ${source.revision}`)
