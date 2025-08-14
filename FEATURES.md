# Local Agent feature inventory and status
## Project overview

- **purpose**: Local, privacy-first desktop assistant with task orchestration, research, file operations, and an animated 3D voice identity
- **runtime**: Electron app (main process orchestrates; renderer provides UI)
- **default llm**: LM Studio via OpenAI-compatible API; Ollama supported in Electron
- **persistence**: SQLite (better-sqlite3) under `~/.local-agent`
- **plugins**: Dynamic worker plugins with manifests and hot-reload

## Core architecture

- **app shell & UI**: `src/App.tsx`, components under `src/components`
- **electron main + ipc**: `electron/main.ts`, `src/agent/runtime.ts`
- **orchestrator/scheduler**: `src/agent/scheduler.ts`
- **task planner**: `src/agent/task_planner.ts`
- **workers**: `src/agent/workers/{fileops,ocr,research,shell}.ts`
- **plugins/registry**: `src/agent/registry.ts`
- **db/events**: `src/db.ts`
- **research synthesis graph**: `src/agent/graph.ts`
- **web helpers**: `src/agent/web.ts`
- **voice identity UI**: `src/components/voice/*`

## Plugin system

- **implemented**:
  - Manifest schema (`zod`) in `src/agent/registry.ts` with fields: `id`, `version`, `entrypoint`, `capabilities[{ role }]`, `permissions[]`
  - Dynamic load from `src/plugins/*/manifest.json`; hot-reload watcher (`watchPlugins`)
  - Plugin events: `plugin_loaded`, `plugin_watch`, `plugin_error`
  - Built-in workers registered at startup (`registerBuiltInWorkers`)
  - CLI manifest validator: `src/scripts/validate-manifest.ts`
- **gaps**:
  - `permissions[]` not enforced end-to-end; no approval prompts or persisted grants
  - No sandboxing strategy (VM/worker_threads/subprocess) or resource quotas

## Orchestrator and scheduler

- **implemented**:
  - Plans tasks via `planTasks` and executes in dependency waves
  - Emits `task_start`, `task_result`, `error`; updates `tasks` table; cancellation via `AbortController`
  - Reviewer step synthesizes research through LangGraph (`src/agent/graph.ts`)
- **gaps**:
  - `budgets.seconds`/`budgets.tokens` exist on tasks but are not enforced
  - No retries/backoff or conditional branches; event envelope not fully standardized

## Task planner

- **implemented**:
  - Deterministic detection for: locate/open/reveal, mkdir, move/copy/rename
  - OCR-aware locate, including uploaded images via `agent/saveUploadedImage`
  - Shell intents (JSON override and `shell:`/`run:` prefixes)
  - App control intents: open/quit/focus/hide/restart (uses `osascript`/`open` through shell worker)
  - Fallback planning via LM Studio for “tasks” and “research” modes; tasks carry `budgets` structure
- **gaps**:
  - Does not generate conditional branches/retries; budgets not honored by scheduler

## Workers

- **file operations** (`src/agent/workers/fileops.ts`) — complete (core), partial (confirmations)
  - Open/reveal by fuzzy name within scope (Desktop/Documents/Downloads/Pictures)
  - Locate via Spotlight (`mdfind`) + shallow directory scan; content-aware via OCR handoff
  - Create directory, move/copy, rename (tilde and desktop resolution); default summary file write from research outputs
  - Events: `file_open`, `file_located`, `file_created`, `file_moved`, `file_copied`, `file_renamed`, `file_write`
  - Gap: dangerous-operation confirmations are not yet wired

- **shell** (`src/agent/workers/shell.ts`) — partial
  - Parses JSON/`shell:`/`run:`; whitelisted commands bypass confirmation
  - Non-whitelisted require confirmation unless `automation` mode
  - Streams output via `shell_output`; emits `shell_start`/`shell_end`; optional `dm_*` hints
  - Gaps: limited whitelist; no plugin permission enforcement layer

- **ocr** (`src/agent/workers/ocr.ts`) — complete (MVP), robust
  - Primary: Apple Vision (Swift via `xcrun`) with downscaling; 10s timeouts; detailed event logging
  - Fallback: Tesseract.js (WASM) with progress events and 20s timeout
  - OCR result caching in `~/.local-agent/ocr-cache`
  - Directory scanning, batching, thresholds, early-stop on strong matches; cancellation support
  - Uploaded image handling emits `ocr_response` with extracted text
  - Events include: `ocr_start`, `ocr_scan_*`, `ocr_file_*`, `ocr_batch_*`, `ocr_complete`, `ocr_response`, `error`

- **research** (`src/agent/workers/research.ts`) — partial
  - Playwright browser with optional Tavily API (`TAVILY_API_KEY`); fallbacks to DuckDuckGo HTML and Bing
  - Ranks/limits sources, writes per-source markdown snippets and an aggregate corpus file
  - Events: `research_start`, `search_vendor`, `search_error`, `targets_ranked`, `extract_result`, `research_result`
  - Gaps: no network permission gating or rate controls

- **reviewer synthesis** (`src/agent/graph.ts`) — partial
  - LangGraph pipeline to parse aggregate and generate synthesis with LM Studio
  - Events: `graph_extract_*`, `graph_synthesize_*`
  - Gaps: no streaming; not integrated with budgets

## Database and events

- **implemented**:
  - SQLite (WAL) at `~/.local-agent/agent.db`
  - Tables: `sessions`, `runs`, `run_events`, `tasks`; indices on `run_events(run_id,id)` and `tasks(run_id,id,status)`
  - Event streaming via `eventBus`; history queries and `getTaskResultsByRole`
  - Daily pruning with configurable retention
- **gaps**:
  - Event payload schema not strictly validated across system boundaries

## IPC and APIs (Electron main)

- **task control**:
  - `agent/startTask({ prompt, model?, deep?, dryRun?, automation? })`
  - `agent/cancelRun({ runId })`
  - `agent/getHistory({ sessionId? })`
  - `agent/confirmDangerous({ runId, taskId, confirm })`
- **files/system**:
  - `agent/openPath({ path })`, `agent/revealInFolder({ path })`, `agent/readFileText({ path })`
- **models/settings**:
  - `agent/setDefaultModel({ model })`
  - `agent/getVisualizerVariant()` / `agent/setVisualizerVariant({ variant })`
- **voice**:
  - TTS: `agent/voiceTTS({ text, voiceId?, modelId? })` via ElevenLabs; `agent/elevenVoices()`
  - STT: `agent/speechToText({ audioBase64, mimeType?, fileName? })` via local Whisper HTTP or OpenAI fallback
  - Upload image: `agent/saveUploadedImage({ dataUrl, fileName })`
- **chat**:
  - `agent/simpleChat({ messages, model?, temperature?, reasoningLevel? })` (optional quick web context)

## UI/UX

- **chat input**: sticky send/stop button, slash commands, image upload preview, reasoning toggle, quick web toggle, mode selector (Chat/Tasks/Research)
- **logs viewer**: sticky header, level/verbose filters, auto-scroll, clear; icons and payload details per event
- **gaps**: model picker UI may need surfacing/binding to `agent/setDefaultModel`

## Voice and 3D identity

- **components**:
  - `VoiceIdentity.tsx` renders `VisualizerSwitcher`
  - `VisualizerSwitcher.tsx` loads/saves `visualizerVariant` via IPC or localStorage; includes `VisualizerSettings`
  - `BlobVisualizer.tsx` (three.js/fiber) variants: `halo`, `blob`, `particles`, `waves`, `geometric`, `aurora`; themeable with graceful fallbacks
- **persistence**: variant stored in `~/.local-agent/config.json` (or localStorage in web builds)
- **gaps**: audio-reactivity could be expanded (mic intensity mapping); more identity presets

## Configuration

- **config file**: `~/.local-agent/config.json` with `defaultModel`, `retentionDays`, `visualizerVariant`
- **helpers**: `src/agent/config.ts`

## Security and sandboxing

- **implemented**: confirmation for non-whitelisted shell commands (unless `automation`)
- **gaps**: no sandbox/allowlist for fs/network; no plugin-permission enforcement; no CPU/memory/time quotas beyond per-op timeouts (e.g., OCR)

## Tests

- **present**:
  - Planner tests: `src/agent/task_planner.test.ts`
  - Shell worker tests: `src/agent/workers/shell.test.ts`
  - Voice visualizer tests: `src/components/voice/*.test.tsx`
  - Utils tests: `src/lib/utils.test.ts`
- **gaps**:
  - E2E tests for research and OCR flows
  - Tests for plugin loader, permission prompts, budgets/enforcement

## Environment keys

- **LM Studio**: `LMSTUDIO_HOST`, `LMSTUDIO_MODEL`
- **Ollama**: `OLLAMA_URL`, `OLLAMA_MODEL`
- **Web search**: `TAVILY_API_KEY` (optional)
- **Whisper STT**: `WHISPER_HTTP_URL` (preferred) or `OPENAI_API_KEY` fallback
- **ElevenLabs TTS**: `ELEVENLABS_API_KEY`

## High-value next steps

- Enforce plugin `permissions` with IPC approval prompts and persisted grants; add audit entries to `run_events`
- Honor `budgets.seconds/tokens`, add retries/backoff and simple conditional branches; standardize event envelopes
- Add sandbox/resource guards for file/network and plugin isolation; consider worker_threads/subprocess
- Polish model selection UI and persistence
- Add tests for research/OCR, plugin lifecycle/permissions, and budgets

