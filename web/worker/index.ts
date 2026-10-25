// The DRAKON Worker: forwards /api/* to the Go API, serves everything else
// from the Vite build. About 40 lines; this is not a backend, it only
// passes requests through (blueprint part 4, decision 1).
//
// Kept free of extra packages: the two types below are all it needs.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  API_ORIGIN: string // https://drakon-api.onrender.com (wrangler.jsonc "vars")
  // Shared with the Go API (Render: PROXY_SECRET, TRUSTED_PROXY=cloudflare).
  // A Worker secret, never in wrangler.jsonc: npx wrangler secret put PROXY_SECRET
  PROXY_SECRET?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request) // the website itself
    }

    // Same path and query on the API server.
    const target = new URL(url.pathname + url.search, env.API_ORIGIN)
    const headers = new Headers(request.headers) // cookies and Origin go along unchanged
    headers.delete('host') // the API server's own host name is used
    // A visitor must not send these two themselves.
    headers.delete('X-Drakon-Client-IP')
    headers.delete('X-Drakon-Proxy-Secret')
    // The real visitor's IP, for the API's per-IP rate limits. Cloudflare
    // sets CF-Connecting-IP; a visitor cannot change it. The secret proves
    // to the API that this request came through this Worker.
    const ip = request.headers.get('CF-Connecting-IP')
    if (ip) {
      headers.set('X-Real-IP', ip)
      headers.set('X-Forwarded-For', ip)
      if (env.PROXY_SECRET) {
        headers.set('X-Drakon-Client-IP', ip)
        headers.set('X-Drakon-Proxy-Secret', env.PROXY_SECRET)
      }
    }
    headers.set('X-Forwarded-Proto', 'https')
    headers.set('X-Forwarded-Host', url.host)

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
    const response = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual', // pass redirects to the browser, do not follow them here
    })
    // The answer goes back as it is, Set-Cookie headers included.
    return response
  },
}
