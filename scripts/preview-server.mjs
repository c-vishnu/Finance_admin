import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");
const template = require("@babel/template").default;

const ROOT = path.resolve(import.meta.dirname, "..");
const DEPS_DIR = path.join(ROOT, "node_modules", ".vite", "deps");
const DEPS_URL = "/node_modules/.vite/deps/";
const PORT = Number(process.env.PREVIEW_PORT || 4001);
const JSX_ID = "_ReactJsx";

const DEPS = {};
const INTEROP = new Set();
try {
  const meta = JSON.parse(fs.readFileSync(path.join(DEPS_DIR, "_metadata.json"), "utf8"));
  for (const [name, info] of Object.entries(meta.optimized || {})) {
    DEPS[name] = info.file;
    if (info.needsInterop) INTEROP.add(name);
  }
} catch (e) {
  console.error("cannot read .vite/deps/_metadata.json:", e.message);
}

const MIME = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".jsx":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".svg":"image/svg+xml",".webp":"image/webp",".woff2":"font/woff2",".ico":"image/x-icon",".map":"application/json; charset=utf-8"};
const mimeOf = f => MIME[path.extname(f).toLowerCase()] || "application/octet-stream";

const ENTITIES = {amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:"\u00a0",copy:"\u00a9",reg:"\u00ae",hellip:"\u2026",mdash:"\u2014",ndash:"\u2013",times:"\u00d7",middot:"\u00b7",minus:"\u2212",rarr:"\u2192",larr:"\u2190",deg:"\u00b0",rsquo:"\u2019",lsquo:"\u2018",ldquo:"\u201c",rdquo:"\u201d",rupee:"\u20b9"};
const decodeEntities = str => str.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
  if (body[0] === "#") {
    const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  const hit = ENTITIES[body];
  return hit === undefined ? m : hit;
});

function cleanJSXText(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmpty = i;
  let out = "";
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\t/g, " ");
    if (i !== 0) line = line.replace(/^ +/, "");
    if (i !== lines.length - 1) line = line.replace(/ +$/, "");
    if (line) {
      if (i !== lastNonEmpty) line += " ";
      out += line;
    }
  }
  return decodeEntities(out);
}

const cssTpl = template.expression('(function(){var l=document.createElement("link");l.rel="stylesheet";l.href=%%URL%%;document.head.appendChild(l);})()');

function makePlugin() {
  let sawJsx = false;
  return ({types: t}) => {
    const cat = name => t.memberExpression(t.identifier(JSX_ID), t.identifier(name));
    const typeOf = name => {
      if (name.type === "JSXIdentifier") return /^[a-z]/.test(name.name) ? t.stringLiteral(name.name) : t.identifier(name.name);
      if (name.type === "JSXMemberExpression") return t.memberExpression(typeOf(name.object), t.identifier(name.property.name));
      if (name.type === "JSXNamespacedName") return t.stringLiteral(name.namespace.name + ":" + name.name.name);
      return t.identifier(name.name);
    };
    const propsOf = attrs => t.objectExpression(attrs.map(a => {
      if (a.type === "JSXSpreadAttribute") return t.spreadElement(a.argument);
      const raw = a.name.name;
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(raw) ? t.identifier(raw) : t.stringLiteral(raw);
      let value;
      if (a.value == null) value = t.booleanLiteral(true);
      else if (a.value.type === "JSXExpressionContainer") value = a.value.expression.type === "JSXEmptyExpression" ? t.booleanLiteral(true) : a.value.expression;
      else value = t.stringLiteral(a.value.value);
      return t.objectProperty(key, value);
    }));
    const kidsOf = children => children.map(c => {
      if (c.type === "JSXText") { const txt = cleanJSXText(c.value); return txt === "" ? null : t.stringLiteral(txt); }
      if (c.type === "JSXExpressionContainer") return c.expression.type === "JSXEmptyExpression" ? null : c.expression;
      if (c.type === "JSXSpreadChild") return c.expression;
      return c;
    }).filter(Boolean);
    const finishSource = (p, source) => {
      const value = source.value;
      if (/\.css$/.test(value)) return "css";
      if (/^[./]/.test(value)) { const abs = resolveRelative(p.hub.file.opts.filename, value); if (abs) source.value = urlFromRoot(abs); return "done"; }
      if (DEPS[value]) { source.value = DEPS_URL + DEPS[value]; return "done"; }
      return "done";
    };
    return {
      name: "mini-jsx",
      visitor: {
        ImportDeclaration(p) {
          const node = p.node;
          const value = node.source.value;
          if (/\.css$/.test(value)) {
            const abs = resolveRelative(p.hub.file.opts.filename, value);
            p.replaceWith(t.expressionStatement(cssTpl({URL: t.stringLiteral(abs ? urlFromRoot(abs) : value)})));
            return;
          }
          if (/^[./]/.test(value)) {
            const abs = resolveRelative(p.hub.file.opts.filename, value);
            if (abs) node.source.value = urlFromRoot(abs);
            return;
          }
          if (!DEPS[value]) return;
          const url = DEPS_URL + DEPS[value];
          if (!INTEROP.has(value)) { node.source.value = url; return; }
          const named = node.specifiers.filter(sp => sp.type === "ImportSpecifier");
          const def = node.specifiers.find(sp => sp.type === "ImportDefaultSpecifier");
          const ns = node.specifiers.find(sp => sp.type === "ImportNamespaceSpecifier");
          const local = def ? def.local : p.scope.generateUidIdentifier("dep");
          const decls = [t.importDeclaration([t.importDefaultSpecifier(t.cloneNode(local))], t.stringLiteral(url))];
          if (named.length) {
            decls.push(t.variableDeclaration("const", [t.variableDeclarator(
              t.objectPattern(named.map(sp => {
                const shorthand = sp.imported.type === "Identifier" && sp.imported.name === sp.local.name;
                const key = sp.imported.type === "Identifier" ? t.identifier(sp.imported.name) : t.stringLiteral(sp.imported.value);
                return t.objectProperty(key, t.cloneNode(sp.local), false, shorthand);
              })),
              t.cloneNode(local)
            )]));
          }
          if (ns) decls.push(t.variableDeclaration("const", [t.variableDeclarator(t.cloneNode(ns.local), t.cloneNode(local))]));
          p.replaceWithMultiple(decls);
        },
        ExportNamedDeclaration(p) { if (p.node.source) finishSource(p, p.node.source); },
        ExportAllDeclaration(p) { if (p.node.source) finishSource(p, p.node.source); },
        JSXElement: { exit(p) { const n = p.node; sawJsx = true; p.replaceWith(t.callExpression(cat("createElement"), [typeOf(n.openingElement.name), propsOf(n.openingElement.attributes), ...kidsOf(n.children)])); } },
        JSXFragment: { exit(p) { sawJsx = true; p.replaceWith(t.callExpression(cat("createElement"), [t.memberExpression(t.identifier(JSX_ID), t.identifier("Fragment")), t.nullLiteral(), ...kidsOf(p.node.children)])); } },
        Program: { exit(p) {
          if (!sawJsx) return;
          const body = p.node.body;
          const hasReact = body.some(n => n.type === "ImportDeclaration" && n.source.value === "react" && n.specifiers.some(s => s.type === "ImportDefaultSpecifier" || s.type === "ImportNamespaceSpecifier"));
          const hasLocal = body.some(n => n.type === "VariableDeclaration" && n.declarations.some(d => d.id && d.id.name === JSX_ID));
          if (!hasReact && !hasLocal) body.unshift(t.importDeclaration([t.importDefaultSpecifier(t.identifier(JSX_ID))], t.stringLiteral(DEPS_URL + "react.js")));
        } }
      }
    };
  };
}

function urlFromRoot(abs) { return "/" + path.relative(ROOT, abs).split(path.sep).join("/"); }

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, base + ".js", base + ".jsx", base + ".mjs", base + ".json", path.join(base, "index.js"), path.join(base, "index.jsx")];
  for (const c of candidates) { try { if (fs.statSync(c).isFile()) return c; } catch { /* keep looking */ } }
  return null;
}

function safeJoin(base, urlPath) {
  const abs = path.resolve(base, urlPath.replace(/^[/\\]+/, ""));
  return abs === base || abs.startsWith(base + path.sep) ? abs : null;
}

const DIAG = [
  "(function(){",
  "  var errs=[];",
  "  function beacon(m){try{fetch('/__diag?m='+encodeURIComponent(m));}catch(e){}}",
  "  function panel(bg){",
  "    var d=document.getElementById('__diag');",
  "    if(!d){d=document.createElement('div');d.id='__diag';d.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483647;color:#fff;font:12px/1.5 ui-monospace,monospace;padding:8px 10px;max-height:45vh;overflow:auto;white-space:pre-wrap';document.body.appendChild(d);}",
  "    d.style.background=bg;return d;",
  "  }",
  "  function clearPanel(){var d=document.getElementById('__diag');if(d&&d.parentNode)d.parentNode.removeChild(d);}",
  "  function paint(msg){",
  "    if(msg&&errs.indexOf(msg)<0)errs.push(msg);",
  "    document.title='DIAG['+errs.length+'] '+String(errs[0]||'').slice(0,110);",
  "    panel('#7f1d1d').textContent=errs.join(String.fromCharCode(10));",
  "    beacon('ERR '+errs.join(' | '));",
  "  }",
  "  window.addEventListener('error',function(e){",
  "    if(e&&e.target&&e.target.tagName){paint('LOAD FAILED: '+(e.target.src||e.target.href));}",
  "    else{paint('ERROR: '+((e&&e.message)||e));}",
  "  },true);",
  "  window.addEventListener('unhandledrejection',function(e){paint('REJECTED: '+((e&&e.reason&&e.reason.message)||(e&&e.reason)||e));});",
  "  var start=Date.now();var warned=false;var timer=null;",
  "  function check(){",
  "    var r=document.getElementById('root');",
  "    if(!r)return;",
  "    if(r.querySelector('.app')){",
  "      clearInterval(timer);",
  "      if(errs.length===0)clearPanel();",
  "      document.title='Wayvida Books - running';",
  "      beacon('MOUNTED in '+((Date.now()-start)/1000).toFixed(1)+'s');",
  "      return;",
  "    }",
  "    if(errs.length)return;",
  "    var secs=(Date.now()-start)/1000;",
  "    if(secs>10&&!warned){",
  "      warned=true;",
  "      panel('#92400e').textContent='Still starting ('+secs.toFixed(0)+'s). The static preview transforms every module one at a time, so the first load is slow; this notice clears itself once the app renders.';",
  "      beacon('SLOW '+secs.toFixed(1)+'s');",
  "    }",
  "    if(secs>60){clearInterval(timer);paint('app did not mount within 60s; #root is still empty');}",
  "  }",
  "  timer=setInterval(check,250);",
  "  setTimeout(check,50);",
  "})();"
].join(String.fromCharCode(10));

function sendHtml(res) {
  let html;
  try { html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"); }
  catch (e) { return send(res, 500, "index.html missing"); }
  html = html.replace("</head>", "<script>" + DIAG + "</scr" + "ipt></head>");
  send(res, 200, html, "text/html; charset=utf-8");
}

function send(res, code, body, type) {
  console.log(String(code).padEnd(5) + (res && res.__p ? res.__p : ""));
  res.writeHead(code, {"Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*"});
  res.end(body);
}
function sendFile(res, file, type) {
  try { send(res, 200, fs.readFileSync(file), type || mimeOf(file)); }
  catch (e) { send(res, 404, "Not found: " + file); }
}
const MODULE_CACHE = new Map();
function transformFile(file) {
  const stat = fs.statSync(file);
  const hit = MODULE_CACHE.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.code;
  const code = fs.readFileSync(file, "utf8");
  const out = babel.transformSync(code, {filename: file, babelrc: false, configFile: false, sourceType: "module", parserOpts: {plugins: ["jsx"]}, plugins: [makePlugin()], sourceMaps: false});
  MODULE_CACHE.set(file, {mtimeMs: stat.mtimeMs, size: stat.size, code: out.code});
  return out.code;
}
function walkModules(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkModules(full, out);
    else if (/\.(jsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}
function sendModule(res, file) {
  let code;
  try { code = transformFile(file); }
  catch (e) {
    if (!fs.existsSync(file)) return send(res, 404, "Not found: " + file);
    console.error("transform failed:", file, "-", e.message);
    return send(res, 200, "console.error(" + JSON.stringify("Preview transform failed for " + path.relative(ROOT, file) + ": " + e.message) + ");", "text/javascript; charset=utf-8");
  }
  send(res, 200, code, "text/javascript; charset=utf-8");
}
const server = http.createServer((req, res) => {
  let u, pathname;
  try { u = new URL(req.url, "http://localhost"); pathname = decodeURIComponent(u.pathname); }
  catch (e) { return send(res, 400, "Bad request"); }
  res.__p = pathname;
  if (pathname === "/__diag") {
    console.log(">>> PAGE-REPORT " + (u.searchParams.get("m") || "(empty)"));
    res.writeHead(204, {"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"});
    return res.end();
  }
  if (pathname === "/" || pathname === "/index.html") return sendHtml(res);
  if (pathname.startsWith(DEPS_URL)) {
    const file = safeJoin(DEPS_DIR, pathname.slice(DEPS_URL.length));
    return file ? sendFile(res, file, mimeOf(file)) : send(res, 403, "Forbidden");
  }
  if (pathname.startsWith("/src/")) {
    const file = safeJoin(ROOT, pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, "Not found: " + pathname);
    if (/\.(jsx|js|mjs)$/.test(file)) return sendModule(res, file);
    return sendFile(res, file, mimeOf(file));
  }
  const pub = safeJoin(path.join(ROOT, "public"), pathname);
  if (pub && fs.existsSync(pub) && fs.statSync(pub).isFile()) return sendFile(res, pub, mimeOf(pub));
  return send(res, 404, "Not found: " + pathname);
});

export const PATHS = {ROOT, DEPS_DIR, DEPS_URL, JSX_ID, DEPS};

export function transformModule(file, pluginFactory) {
  const code = fs.readFileSync(file, "utf8");
  return babel.transformSync(code, {filename: file, babelrc: false, configFile: false, sourceType: "module", parserOpts: {plugins: ["jsx"]}, plugins: [pluginFactory || makePlugin()], sourceMaps: false}).code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const warmStart = Date.now();
  let warmed = 0;
  for (const file of walkModules(path.join(ROOT, "src"))) {
    try { transformFile(file); warmed++; }
    catch (e) { console.error("prewarm skipped:", path.relative(ROOT, file), "-", e.message); }
  }
  console.log("pre-transformed " + warmed + " modules in " + (Date.now() - warmStart) + " ms");
  server.listen(PORT, () => {
    console.log("Wayvida Books preview running at http://localhost:" + PORT + "/");
    console.log("(static dev preview: Babel JSX transform in-process, Vite pre-bundled deps from node_modules/.vite/deps)");
  });
}
