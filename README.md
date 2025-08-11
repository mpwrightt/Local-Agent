# Local Agent (Vite + React)

Modern local agent UI with Electron bridge, optional browser Chat fallback, and Vercel-ready proxy for LM Studio.

## Dev

```bash
npm i
npm run dev
```

- Electron window provides full capabilities (Tasks/Research via OS automation).
- Browser at http://localhost:5173 supports Chat and quick search.

## Build

```bash
npm run build
npm run start:prod
```

## Vercel deployment (UI + LM proxy)

This repo includes a serverless proxy at `api/lm/[...path].ts` so the web UI can call an OpenAI-compatible endpoint without CORS issues.

1) Set env var on Vercel:
- `LM_PROXY_BASE` → LM Studio/OpenAI-compatible base URL, e.g.:
  - `http://127.0.0.1:1234` (via a tunnel like ngrok)
  - `https://YOUR_SUBDOMAIN.ngrok.app`

2) Deploy
- Build command: `npm run build`
- Output dir: `dist`
- The included `vercel.json` routes `/lm/*` to the proxy and serves `/dist`.

In the browser, Chat calls `/lm/v1/...`, which the proxy forwards to `LM_PROXY_BASE`.

## Remote Tasks/Research

Tasks/Research require a local agent on your Mac (for shell/file automation and app control). Next step:
- Add a lightweight HTTP/WS agent service
- Expose it via ngrok (or Cloudflare Tunnel)
- Wire the UI to a “Remote mode” that targets the agent service

## Configuration

- LM Studio base (browser mode): `/lm/v1` (proxied in dev/preview and Vercel)
- Electron bridge: available automatically in Electron app via `window.agent`
