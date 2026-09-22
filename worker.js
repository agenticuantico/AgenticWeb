const API_PREFIXES = ["/v1/", "/health"];

function isApiPath(pathname) {
  return API_PREFIXES.some(prefix => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
}

function applySecurityHeaders(response, request) {
  const headers = new Headers(response.headers);
  const origin = request?.headers.get("Origin") || "";
  if (origin === "https://agenticuantico.dev.ar" || origin === "https://www.agenticuantico.dev.ar") {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("access-control-allow-methods", "GET,HEAD,POST,OPTIONS,DELETE,PATCH");
    headers.set("access-control-allow-headers", "Content-Type, X-API-Key, X-User-ID");
    headers.set("vary", "Origin");
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://agenticweb.agenticuantico.workers.dev https://agenticuantico.dev.ar; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  headers.delete("x-agenticweb-core");
  headers.delete("server");
  headers.delete("x-powered-by");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return applySecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  }));
}

async function proxyToCore(request, env) {
  if (request.method === "OPTIONS") {
    return applySecurityHeaders(new Response(null, { status: 204 }), request);
  }
  const origin = String(env.CORE_API_ORIGIN || "").trim().replace(/\/$/, "");
  if (!origin) {
    return applySecurityHeaders(json({
      ok: false,
      error: "service_unavailable",
      message: "El servicio de IA está temporalmente no disponible."
    }, 503), request);
  }

  let target;
  try {
    target = new URL(origin + new URL(request.url).pathname + new URL(request.url).search);
    if (target.protocol !== "https:") {
      return applySecurityHeaders(json({ ok: false, error: "service_unavailable", message: "El servicio de IA está temporalmente no disponible." }, 503), request);
    }
  } catch {
    return applySecurityHeaders(json({ ok: false, error: "service_unavailable", message: "El servicio de IA está temporalmente no disponible." }, 503), request);
  }

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("x-api-key");
  headers.delete("x-user-id");
  headers.delete("authorization");
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
    return applySecurityHeaders(response, request);
  } catch (error) {
    return applySecurityHeaders(json({
      ok: false,
      error: "service_unavailable",
      message: "El servicio de IA está temporalmente no disponible."
    }, 502), request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isApiPath(url.pathname)) {
      return proxyToCore(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return applySecurityHeaders(assetResponse, request);
  }
};
