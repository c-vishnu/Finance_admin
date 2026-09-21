/* Wayvida Books Sites worker.

   Serves the built client from the ASSETS binding with an SPA fallback, and hosts the one
   server-side route the app needs: the GST/GSP taxpayer lookup. That lookup exists here and
   not in the browser so the GST credentials stay a server secret - they are read from the
   worker environment (`GST_API_URL`, `GST_API_KEY`) and are never returned to the client. */

const GST_LOOKUP_PATH = "/api/gst/lookup";
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const LOOKUP_FAILED = "Unable to fetch GST details. Please verify the GSTIN or enter the details manually.";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

/* GSP responses differ between providers, so the common field names are accepted and mapped onto
   one shape. The state is returned as its code; the app resolves the code to a state name. */
function normaliseTaxpayer(payload) {
  const source = payload?.data || payload?.taxpayer || payload?.result || payload;
  if (!source || typeof source !== "object") return null;
  const address = source.pradr?.addr || source.principalAddress || source.address || {};
  const pick = (...names) => {
    for (const name of names) {
      const value = source[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const principalAddress = typeof address === "string"
    ? address.trim()
    : [address?.bnm, address?.bno, address?.st, address?.loc, address?.dst, address?.stcd, address?.pnz]
        .map(part => String(part || "").trim())
        .filter(Boolean)
        .join(", ");
  const taxpayer = {
    legalName: pick("legalName", "lgnm", "legal_name"),
    tradeName: pick("tradeName", "tradeNam", "trade_name"),
    status: pick("status", "sts", "gstStatus", "gst_status"),
    taxpayerType: pick("taxpayerType", "dty", "ctb", "taxpayer_type"),
    stateCode: pick("stateCode", "stcd", "state_code") || String(address?.stcd || "").trim(),
    pan: pick("pan", "panNo", "pan_no").toUpperCase(),
    principalAddress,
  };
  return Object.values(taxpayer).some(Boolean) ? taxpayer : null;
}

/* POST /api/gst/lookup - { gstin } in, taxpayer out. The API key is sent upstream only. */
async function handleGstLookup(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, code: "method_not_allowed", message: "Use POST to fetch taxpayer details." }, 405);
  }
  let body = null;
  try { body = await request.json(); } catch { body = null; }
  const gstin = String(body?.gstin || "").trim().toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) {
    return json({ ok: false, code: "invalid_gstin", message: "Enter a valid 15-character GSTIN before fetching taxpayer details." }, 400);
  }
  const apiUrl = env?.GST_API_URL;
  const apiKey = env?.GST_API_KEY;
  if (!apiUrl || !apiKey) {
    return json({ ok: false, code: "not_configured", message: LOOKUP_FAILED }, 503);
  }
  let upstream;
  try {
    upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ gstin }),
    });
  } catch {
    return json({ ok: false, code: "unavailable", message: LOOKUP_FAILED }, 502);
  }
  if (!upstream.ok) {
    return json({ ok: false, code: upstream.status === 404 ? "not_found" : "upstream_error", message: LOOKUP_FAILED }, 502);
  }
  let payload = null;
  try { payload = await upstream.json(); } catch { payload = null; }
  const taxpayer = normaliseTaxpayer(payload);
  if (!taxpayer) {
    return json({ ok: false, code: "not_found", message: LOOKUP_FAILED }, 404);
  }
  return json({ ok: true, status: taxpayer.status || "", taxpayer, fetchedAt: new Date().toISOString() });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === GST_LOOKUP_PATH) return handleGstLookup(request, env);

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
