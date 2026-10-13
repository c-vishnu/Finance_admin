import {readFileSync, readdirSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const files = readdirSync(SRC).filter((f) => f.endsWith(".css"));

const interesting = /Overlay|overlay|Drawer|drawer/;
const side = /justify-content|(^|;|\s)(left|right|inset):|transform:|flex-direction|margin-left|margin-right|place-items/;

const hits = new Map();
for (const file of files) {
  const text = readFileSync(path.join(SRC, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = text.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const m of rules) {
    const sel = m[1].trim().replace(/\s+/g, " ");
    const body = m[2].trim().replace(/\s+/g, " ");
    if (!interesting.test(sel)) continue;
    if (!side.test(body)) continue;
    if (!/position|flex|grid|inset|margin|transform/.test(body)) continue;
    const key = sel;
    if (!hits.has(key)) hits.set(key, []);
    hits.get(key).push(file + " :: " + body.slice(0, 200));
  }
}
const rows = [...hits.entries()].filter(([sel]) => /Overlay|Drawer/.test(sel));
rows.sort((a, b) => a[0].localeCompare(b[0]));
for (const [sel, list] of rows) {
  console.log("SEL  " + sel);
  for (const l of list) console.log("      " + l);
}
console.log("");
console.log("rule count: " + rows.length);