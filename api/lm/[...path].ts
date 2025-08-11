// Simple Vercel serverless proxy for LM Studio (or any OpenAI-compatible endpoint)
// Usage: front-end calls /api/lm/v1/chat/completions → forwarded to LM_PROXY_BASE + /v1/chat/completions

export default async function handler(req: any, res: any) {
  // Allow preflight just in case callers hit this from other origins
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.status(200).end()
    return
  }

  const base = process.env.LM_PROXY_BASE || 'http://127.0.0.1:1234'
  const rawPath = Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || '')
  const qs = req.url && req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : ''
  const target = `${base.replace(/\/$/, '')}/${rawPath}${qs}`

  // Copy headers but drop host. Optionally inject default Authorization from env.
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (!v) continue
    if (k.toLowerCase() === 'host') continue
    headers[k] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  if (!headers['authorization'] && process.env.LM_PROXY_AUTH) {
    headers['authorization'] = process.env.LM_PROXY_AUTH
  }
  // Ensure JSON content type if the body is an object
  const method = req.method || 'GET'
  let body: any = undefined
  if (method !== 'GET' && method !== 'HEAD') {
    if (req.body && typeof req.body === 'object' && !(req.body instanceof Buffer)) {
      headers['content-type'] = headers['content-type'] || 'application/json'
      body = JSON.stringify(req.body)
    } else {
      body = req.body
    }
  }

  try {
    const upstream = await fetch(target, { method, headers, body })
    // Pass through key headers
    res.status(upstream.status)
    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)
    const cc = upstream.headers.get('cache-control')
    if (cc) res.setHeader('cache-control', cc)
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.send(buf)
  } catch (e: any) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}


