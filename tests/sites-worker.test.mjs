import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});

test("the GST lookup route keeps the credential server-side", async () => {
  const original = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(
      JSON.stringify({
        lgnm: "ABC Retail Private Limited",
        tradeNam: "ABC Retail",
        sts: "Active",
        dty: "Regular",
        stcd: "27",
        pan: "aapfu0939f",
        pradr: { addr: { bnm: "12 MG Road", dst: "Ernakulam", stcd: "27", pnz: "682001" } },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    let assetCalls = 0;
    const response = await worker.fetch(
      new Request("https://example.test/api/gst/lookup", {
        method: "POST",
        body: JSON.stringify({ gstin: "27aapfu0939f1zv" }),
      }),
      {
        ASSETS: { fetch: async () => { assetCalls += 1; return new Response("asset"); } },
        GST_API_URL: "https://gsp.example.test/v1/search",
        GST_API_KEY: "super-secret-key",
      },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.taxpayer.legalName, "ABC Retail Private Limited");
    assert.equal(body.taxpayer.tradeName, "ABC Retail");
    assert.equal(body.taxpayer.status, "Active");
    assert.equal(body.taxpayer.taxpayerType, "Regular");
    assert.equal(body.taxpayer.stateCode, "27");
    assert.equal(body.taxpayer.pan, "AAPFU0939F");
    assert.ok(body.taxpayer.principalAddress.includes("12 MG Road"));
    assert.ok(body.fetchedAt, "the response carries the audit timestamp");
    assert.equal(assetCalls, 0, "the API route never falls through to the asset handler");
    assert.equal(captured.url, "https://gsp.example.test/v1/search");
    assert.equal(captured.options.headers["x-api-key"], "super-secret-key");
    assert.ok(!JSON.stringify(body).includes("super-secret-key"), "the key is never echoed to the client");
  } finally {
    globalThis.fetch = original;
  }
});

test("the GST lookup answers a clear failure instead of blocking the form", async () => {
  const assets = { fetch: async () => new Response("asset") };
  const lookup = (body, env) =>
    worker.fetch(new Request("https://example.test/api/gst/lookup", { method: "POST", body: JSON.stringify(body) }), { ASSETS: assets, ...env });
  const FAILED = "Unable to fetch GST details. Please verify the GSTIN or enter the details manually.";

  const notConfigured = await lookup({ gstin: "27AAPFU0939F1ZV" }, {});
  assert.equal(notConfigured.status, 503);
  assert.equal((await notConfigured.json()).code, "not_configured");

  const malformed = await lookup({ gstin: "27AAPFU0939F1Z" }, { GST_API_URL: "https://gsp.example.test", GST_API_KEY: "k" });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "invalid_gstin");

  const wrongMethod = await worker.fetch(new Request("https://example.test/api/gst/lookup"), { ASSETS: assets });
  assert.equal(wrongMethod.status, 405);

  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network down"); };
  try {
    const down = await lookup({ gstin: "27AAPFU0939F1ZV" }, { GST_API_URL: "https://gsp.example.test", GST_API_KEY: "k" });
    assert.equal(down.status, 502);
    const body = await down.json();
    assert.equal(body.code, "unavailable");
    assert.equal(body.message, FAILED);
  } finally {
    globalThis.fetch = original;
  }
});
