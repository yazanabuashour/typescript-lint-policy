import * as NodeCrypto from "node:crypto"
import * as NodeFS from "node:fs"
import * as NodePath from "node:path"
import * as NodeURL from "node:url"

export const root = NodeURL.fileURLToPath(new URL("../", import.meta.url))

export function sha256(value) {
  return NodeCrypto.createHash("sha256").update(value).digest("hex")
}

export function fileHashes(directory, entries) {
  const files = entries.flatMap((entry) => {
    const path = NodePath.join(directory, entry)
    const stat = NodeFS.lstatSync(path)
    if (stat.isSymbolicLink()) throw new Error(`Symlink not allowed: ${entry}`)
    return stat.isDirectory()
      ? Object.entries(fileHashes(path, NodeFS.readdirSync(path))).map(
          ([file, digest]) => [`${entry}/${file}`, digest],
        )
      : [[entry, sha256(NodeFS.readFileSync(path))]]
  })
  const hashes = new Map(files)
  return Object.fromEntries(
    [...hashes.keys()].sort().map((file) => [file, hashes.get(file)]),
  )
}

export function sourceHashes() {
  return fileHashes(root, [
    "src",
    "scripts",
    "tools/typescript-config-policy",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
    "UPSTREAM-SOURCE.json",
  ])
}
