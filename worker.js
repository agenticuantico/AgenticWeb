const API_PREFIXES = ["/v1/", "/health"];

function isApiPath(pathname) {
  return API_PREFIXES.some(prefix => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin"
    }
  });
}

async function proxyToCore(request, env) {
  const origin = String(env.CORE_API_ORIGIN || "").trim().replace(/\/$/, "");
  if (!origin) {
    return json({
      ok: false,
      error: "core_api_not_configured",
      message: "El puente con el cerebro todavía no tiene configurado CORE_API_ORIGIN."
    }, 503);
  }

  let target;
  try {
    target = new URL(origin + new URL(request.url).pathname + new URL(request.url).search);
    if (target.protocol !== "https:") {
      return json({ok:false,error:"core_api_requires_https"}, 503);
    }
  } catch {
    return json({ok:false,error:"core_api_origin_invalid"}, 503);
  }

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-agenticweb-proxy", "cloudflare");
  headers.set("x-forwarded-host", new URL(request.url).host);
  headers.set("x-forwarded-proto", "https");

  const upstreamRequest = new Request(target.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual"
  });

  try {
    const upstream = await fetch(upstreamRequest, { cf: { cacheTtl: 0, cacheEverything: false } });
    const response = new Response(upstream.body, upstream);
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-agenticweb-core", "connected");
    return response;
  } catch (error) {
    return json({
      ok: false,
      error: "core_api_unreachable",
      message: "No se pudo contactar al cerebro de AgentiCuantico.",
      detail: error instanceof Error ? error.message : "upstream_fetch_failed"
    }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isApiPath(url.pathname)) {
      return proxyToCore(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
