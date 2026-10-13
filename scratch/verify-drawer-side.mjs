import {readFileSync} from "node:fs";
import {transformModule, PATHS} from "../scripts/preview-server.mjs";

const checks = [];
const ok = (name, pass, detail = "") => checks.push({name, pass, detail});

async function get(path) {
  const res = await fetch("http://localhost:4001" + path);
  return {status: res.status, body: await res.text()};
}

for (const [file, overlay, drawer] of [
  ["IncomeReport.jsx", "opsOverlay irOverlay", "opsDrawer irDrawer"],
  ["ExpenseReport.jsx", "opsOverlay exOverlay", "opsDrawer exDrawer"],
]) {
  const src = readFileSync(new URL("../src/" + file, import.meta.url), "utf8");
  const out = transformModule(new URL("../src/" + file, import.meta.url).pathname.replace(/^\//, ""));
  ok("transform " + file + " keeps " + overlay, out.includes('"' + overlay + '"'), "");
  ok("transform " + file + " keeps " + drawer, out.includes('"' + drawer + '"'), "");
  const served = await get("/src/" + file);
  ok("served " + file + " status 200", served.status === 200, String(served.status));
  ok("served " + file + " carries " + overlay, served.body.includes(overlay), "");
  ok("served " + file + " carries " + drawer, served.body.includes(drawer), "");
}

const uq = await get("/src/ui-quality-polish.css");
ok("served ui-quality-polish.css pins overlays right", /:where\(\.trOverlay,\.guideBackdrop,\.bankDrawerBackdrop,\.opsOverlay\)\{\s*justify-content:flex-end!important/.test(uq.body), "");
ok("served ui-quality-polish.css pins drawers right", /margin-left:auto!important;\s*margin-right:0!important/.test(uq.body), "");
ok("served ui-quality-polish.css has no drawer left-pin", !/\.(ex|ir|ops)Overlay[^{]*\{[^}]*flex-start/.test(uq.body), "");

for (const name of ["expense-detail-drawer.css", "income-detail-drawer.css"]) {
  const c = readFileSync(new URL("../src/" + name, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(name + " declares no side rule", !/justify-content|margin-left|margin-right|border-right/.test(c), "");
  ok(name + " has no flex-start", !/flex-start/.test(c), "");
}

const om = await get("/src/operational-modules.css");
ok("served operational-modules.css pins .opsOverlay right", /\.opsOverlay\{[^}]*justify-content:flex-end/.test(om.body), "");
ok("served operational-modules.css has no .opsOverlay flex-start", !/\.opsOverlay\{[^}]*flex-start/.test(om.body), "");
ok("served operational-modules.css has no .opsDrawer left rule", !/\.opsDrawer\{[^}]*\bleft:/.test(om.body), "");

let failed = 0;
for (const c of checks) {
  if (!c.pass) failed++;
  console.log((c.pass ? "PASS  " : "FAIL  ") + c.name + (c.detail ? "  [" + c.detail + "]" : ""));
}
console.log("");
console.log(failed === 0 ? "ALL " + checks.length + " CHECKS PASS" : failed + " of " + checks.length + " CHECKS FAILED");