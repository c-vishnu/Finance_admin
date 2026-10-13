#!/usr/bin/env node
/**
 * Wayvida Books - local preview launcher.
 *
 * `npm run dev` is pinned to host 0.0.0.0 on port 4001 with `strictPort`, in
 * `vite.config.mjs` and in the npm script itself (pinned by `tests/vite-port.test.mjs`),
 * so it stops outright when that port is taken. This launcher is the friendlier local
 * preview: it serves the same Vite dev server on port 5173 by default, steps to the next
 * free port when the requested one is already held by an earlier run instead of dying, and
 * prints the URL it settled on.
 *
 * Usage:
 *   npm run dev:local
 *   npm run dev:local -- --port 5173
 *   $env:DEV_PORT = '5173'; npm run dev:local
 *
 * Port precedence: --port/-p <n> > --port=<n> > DEV_PORT > PORT > 5173.
 *
 * It also installs a portable fallback for the `fs.realpath` family before Vite is loaded.
 * Vite resolves module paths through `fs.realpath.native`, and a restricted shell that
 * refuses that syscall makes the dev server fail with `EPERM ... realpath` and
 * `Failed to resolve dependency: react`. The fallback answers those calls with the
 * JavaScript implementation the same shells allow. It touches this dev process only, and
 * never the build.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import util from "node:util";
import { pathToFileURL } from "node:url";

export const DEFAULT_HOST = "0.0.0.0";
export const DEFAULT_PORT = 5173;
const PORT_SCAN_LIMIT = 25;

export function readRequestedPort(argv, env) {
  const args = argv ?? process.argv.slice(2);
  const variables = env ?? process.env;
  let requested;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--port" || arg === "-p") { requested = args[index + 1]; break; }
    if (arg.startsWith("--port=")) { requested = arg.slice("--port=".length); break; }
  }
  if (requested === undefined || requested === "") requested = variables.DEV_PORT ?? variables.PORT;
  const port = Number.parseInt(String(requested ?? DEFAULT_PORT), 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

export function isPortFree(port, host) {
  const address = host ?? DEFAULT_HOST;
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", () => resolve(false));
    probe.listen(port, address, () => probe.close(() => resolve(true)));
  });
}

export async function pickFreePort(preferred, host, limit) {
  const address = host ?? DEFAULT_HOST;
  const ceiling = preferred + (limit ?? PORT_SCAN_LIMIT);
  for (let port = preferred; port < ceiling && port < 65536; port += 1) {
    if (await isPortFree(port, address)) return port;
  }
  return null;
}

export function installRealpathFallback(target) {
  const runtime = target ?? fs;
  const originalSync = runtime.realpathSync;
  const realpathSync = (...args) => {
    try {
      return originalSync(...args);
    } catch (error) {
      const denied = error && (error.code === "EPERM" || error.code === "EACCES");
      if (!denied) throw error;
      const candidate = args[0];
      return Buffer.isBuffer(candidate) ? candidate : path.resolve(String(candidate));
    }
  };
  const promisify = (fn) => {
    const promised = (...args) => new Promise((resolve, reject) => {
      try { resolve(fn(...args)); } catch (error) { reject(error); }
    });
    promised[util.promisify.custom] = promised;
    return promised;
  };
  const define = (holder, key, value) => {
    try { Object.defineProperty(holder, key, { value, writable: true, configurable: true }); } catch { /* keep the runtime binding */ }
  };
  define(runtime, "realpath", promisify(realpathSync));
  define(runtime, "realpathSync", realpathSync);
  define(realpathSync, "native", realpathSync);
  if (runtime.promises) {
    define(runtime.promises, "realpath", promisify(realpathSync));
    define(runtime.promises, "realpathNative", promisify(realpathSync));
  }
  return realpathSync;
}

async function main() {
  const requested = readRequestedPort();
  const port = await pickFreePort(requested);
  if (port === null) {
    console.error(`Wayvida Books: no free port between ${requested} and ${requested + PORT_SCAN_LIMIT - 1}.`);
    process.exitCode = 1;
    return;
  }
  const url = `http://localhost:${port}/`;
  console.log("");
  console.log("Wayvida Books - local preview");
  console.log(`  requested port : ${requested}`);
  console.log(`  serving port   : ${port}${port === requested ? "" : `   (${requested} was busy)`}`);
  console.log(`  open           : ${url}`);
  console.log("");
  installRealpathFallback();
  process.argv = [process.argv[0], "vite", "--host", DEFAULT_HOST, "--port", String(port), "--strictPort"];
  await import(new URL("../node_modules/vite/bin/vite.js", import.meta.url).href);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
const invokedDirectly = process.platform === "win32" ? entry.toLowerCase() === import.meta.url.toLowerCase() : entry === import.meta.url;
if (invokedDirectly) await main();