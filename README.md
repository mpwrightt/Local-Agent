# Local Agent (Vite + React)

Modern local agent UI with Electron bridge, optional browser Chat fallback, and Vercel-ready proxy for LM Studio or any OpenAI-compatible endpoint.

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

1) Set env vars on Vercel:
- `LM_PROXY_BASE` → OpenAI-compatible base URL (LM Studio gateway or similar):
  - `http://127.0.0.1:1234` (via a tunnel like ngrok)
  - `https://YOUR_SUBDOMAIN.ngrok.app`
  - Note: Ollama is not OpenAI-compatible; use the Electron app for Ollama (supported directly via IPC).

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
  - Supported providers in Electron: LM Studio (OpenAI API compatible) and Ollama
  - Env vars:
    - `LMSTUDIO_HOST` (default `http://127.0.0.1:1234/v1`)
    - `LMSTUDIO_MODEL` (e.g., `openai/gpt-oss-20b`)
    - `OLLAMA_URL` (default `http://127.0.0.1:11434`)
    - `OLLAMA_MODEL` (e.g., `llama3.1:8b` or prefixed `ollama:llama3.1:8b`)

### Quick start with Ollama (Electron)

Set environment variables before launching Electron:

```bash
export OLLAMA_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=ollama:llama3.1:8b
npm run dev
```

Pick the `ollama:*` model in the model picker.

### Windows support notes

- Shell tasks now use PowerShell on Windows automatically; mac uses zsh.
- File locate/listing works on both; Windows uses a PowerShell search when Spotlight is unavailable.
- OCR uses Tesseract.js on Windows (Vision framework is mac-only).
- App control (open/quit/focus/hide) is currently mac-only; Windows equivalents will be mapped via PowerShell in a future iteration.
