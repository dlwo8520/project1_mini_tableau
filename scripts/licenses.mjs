import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const root = resolve("."),
  seen = new Set(),
  sections = [];
async function locate(name, from) {
  let current = from;
  while (true) {
    const dir = resolve(current, "node_modules", name);
    try {
      await readFile(resolve(dir, "package.json"));
      return dir;
    } catch {}
    const parent = dirname(current);
    if (parent === current) throw new Error(`Missing dependency: ${name}`);
    current = parent;
  }
}
async function collect(name, from) {
  const dir = await locate(name, from);
  if (seen.has(dir)) return;
  seen.add(dir);
  const pkg = JSON.parse(await readFile(resolve(dir, "package.json"), "utf8"));
  const files = (await readdir(dir)).filter((n) =>
    /^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(n),
  );
  const texts = [];
  for (const file of files) {
    try {
      texts.push(`${file}\n${await readFile(resolve(dir, file), "utf8")}`);
    } catch {}
  }
  sections.push(
    `${"=".repeat(72)}\n${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license)}\n${texts.join("\n\n")}`,
  );
  for (const dep of Object.keys(pkg.dependencies ?? {}))
    await collect(dep, dir);
}
const manifest = JSON.parse(await readFile("package.json", "utf8"));
for (const name of Object.keys(manifest.dependencies))
  await collect(name, root);
await writeFile(
  "public/third-party-licenses.txt",
  "Mini Cat — bundled open-source dependency notices\n\n" +
    sections.sort().join("\n\n"),
);
