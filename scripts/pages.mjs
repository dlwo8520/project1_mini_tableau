import { cp, mkdir, writeFile, readdir, unlink } from "node:fs/promises";
// Keep the Pages output reproducible; never remove paths outside docs.
import { resolve, sep } from "node:path";
const root = resolve("docs");
async function clean(dir) {
  for (const item of await readdir(dir, { withFileTypes: true }).catch(
    () => [],
  )) {
    const path = resolve(dir, item.name);
    if (!path.startsWith(root + sep)) throw new Error("Invalid output path");
    if (item.isDirectory()) await clean(path);
    else await unlink(path);
  }
}
await mkdir(root, { recursive: true });
await clean(root);
await cp("dist", root, { recursive: true });
await writeFile(resolve(root, ".nojekyll"), "");
