# Tasks

Use this backlog to track work. Conventions: [ ] Open, [x] Done

## Phase 1: Foundation & Architecture (Sprint focus)
- [x] Plugin architecture system
  - [ ] Worker registry + manifest format
    - [ ] Draft JSON schema (id, version, capabilities, permissions, entrypoint)
    - [ ] Implement zod validation + CLI validator
    - [ ] Versioning policy (semver) and compatibility checks
    - [ ] Example manifests for 3 reference workers
    - [ ] Docs: authoring guide and examples
    - [ ] Tests: schema, validation errors, backwards‑compat
  - [x] Dynamic worker loading (hot‑load/unload)
    - [ ] Worker loader (dynamic import/Worker/child_process strategies)
    - [ ] Lifecycle hooks (init, start, stop, dispose)
    - [x] Hot reload on manifest/file change (watcher)
    - [ ] Error isolation and restart policy
    - [ ] Telemetry hooks (startup time, memory)
  - [ ] Capability/permission model per worker
    - [ ] Permission types (fs read/write, net, shell, browser)
    - [ ] Grant/deny prompts + persisted approvals
    - [ ] Least‑privilege evaluation per task
    - [ ] Audit log of permissioned operations
  - [ ] Sandboxing policy (worker_threads/vm, fs/network guards)
    - [ ] Evaluate sandbox options (VM, worker_threads, subprocess)
    - [ ] Implement fs/net guards + allowlist
    - [ ] Resource quotas (CPU/memory/time)
    - [ ] Security review checklist

- [ ] Enhanced task orchestration
  - [ ] Multi‑agent planning (tool selection)
    - [ ] Tool schema (inputs/outputs/costs)
    - [ ] Planner prompt/templates + examples
    - [ ] Deterministic fallback rules
    - [ ] Plan visualizer (Mermaid)
  - [ ] Conditional execution (if/else), loops, retries
    - [ ] Execution DSL additions (conditions, counters)
    - [ ] Retry policy (exponential backoff)
    - [ ] Error routing (recover/abort/escalate)
  - [ ] Parallel execution of independent tasks
    - [ ] Dependency analysis + wave scheduler
    - [ ] Concurrency limiter per class of work
    - [ ] Result merging + ordering guarantees
  - [ ] Resource limits (CPU/memory/time) per task
    - [ ] Budgets in plan; enforcement in runtime
    - [ ] Timeouts + cancellation propagation
    - [ ] Budget overage reporting

- [ ] Advanced communication layer
  - [ ] Unified streaming responses across workers
    - [ ] Standard event envelope (type, taskId, data)
    - [ ] Partial result streaming + end markers
  - [ ] Multi‑modal IPC channels (image/audio/video)
    - [ ] Binary transport (stream/FileHandle)
    - [ ] Backpressure + chunking
  - [ ] Event pub/sub decoupling
    - [ ] EventBus topics, unsubscribe, wildcards
    - [ ] Durable log (SQLite indices) + replay

- [ ] Infra/DB hygiene
  - [ ] Indexes: run_events(run_id,id), tasks(run_id,id,status)
    - [ ] Add indices and vacuum
    - [ ] Benchmark query latency before/after
  - [ ] Prune old artifacts/logs
    - [ ] Retention policy config
    - [ ] Cleanup job + manual CLI

- [ ] UX basics
  - [ ] Model selection UI (list/set default)
    - [x] IPC setDefaultModel
    - [ ] Dropdown + persistence
    - [ ] Error/empty states
  - [ ] Settings view skeleton
    - [ ] General, Models, Permissions, Logs tabs
    - [ ] Read/write config plumbing

## Phase 2: Core Capability Expansion
- Development & Programming workers
  - [ ] git-worker
    - [ ] Design API (clone, checkout, commit, pull, rebase)
    - [ ] Implement safe config + credential handling
    - [ ] Tests: local repo fixtures
    - [ ] Docs + examples
  - [ ] code-worker
    - [ ] FS abstraction + parser helpers
    - [ ] Refactor/skeleton generation actions
    - [ ] Lint/format integration
  - [ ] package-worker
    - [ ] npm/pip/cargo installers with lockfile respect
    - [ ] Version resolution + safety prompts
  - [ ] test-worker
    - [ ] Jest/Vitest/PyTest adapters
    - [ ] Run selection + summary parsing
  - [ ] api-worker
    - [ ] REST/GraphQL clients, auth support
    - [ ] Schema capture + assertions
  - [ ] docker-worker
    - [ ] Build/run/compose wrappers
    - [ ] Context/volume safety checks

- System administration workers
  - [ ] process-worker (ps/kill/limits)
  - [ ] network-worker (scan/ping/ports)
  - [ ] database-worker (SQL exec/schema)
  - [ ] log-worker (tail/grep/alerts)
  - [ ] backup-worker (snapshot/restore)
  - [ ] cloud-worker (AWS/Azure/GCP primitives)

- Enhanced file operations
  - [ ] archive-worker (zip/tar extract/create)
    - [ ] Support common formats
    - [ ] Password‑protected archives
  - [ ] sync-worker (rsync/copy trees)
    - [ ] Dry‑run planning + diff
  - [ ] watch-worker (FS events to triggers)
    - [ ] Debounce + rule routing
  - [ ] cleanup-worker (organize, dedupe)
    - [ ] Rules (by ext/date/size)

## Phase 3: Creative & Media
- Visual & design
  - [ ] image-worker (gen/edit)
    - [ ] Providers (LM Studio img, external APIs)
    - [ ] Prompt presets, seeds
  - [ ] video-worker
    - [ ] Transcode, cut, concat
  - [ ] design-worker
    - [ ] Figma API integration
  - [ ] pdf-worker
    - [ ] Merge/split/ocr/annotate
  - [ ] presentation-worker
    - [ ] Deck templates + export

- Audio & music
  - [ ] audio-worker (process/convert)
  - [ ] music-worker (MIDI/gen)
  - [ ] voice-worker (TTS/ASR)

- Document & content
  - [ ] writing-worker (outline/edit/proof)
  - [ ] translation-worker (i18n)
  - [ ] markdown-worker (lint/build)

## Phase 4: Automation & Intelligence
- Workflow automation
  - [ ] scheduler-worker (cron)
    - [ ] Spec parser + UI
  - [ ] workflow-worker (Zapier‑like)
    - [ ] Node palette + execution engine
  - [ ] macro-worker (GUI automation)
    - [ ] Recorder/replayer
  - [ ] email-worker (IMAP/SMTP)
    - [ ] Account config + actions

- Communication & collaboration
  - [ ] slack-worker (post/query)
  - [ ] calendar-worker (events)
  - [ ] video-call-worker (Zoom/Teams)
  - [ ] social-worker (post/schedule)

- Data & analytics
  - [ ] data-worker (pandas/SQL)
  - [ ] ml-worker (train/infer)
  - [ ] chart-worker (render)
  - [ ] scraping-worker (Playwright/cheerio)

## Phase 5: Real‑World Integrations
- [ ] iot-worker (HomeKit/MQTT)
- [ ] sensor-worker
- [ ] camera-worker (RTSP, motion)
- [ ] maps-worker (routes/geocode)
- [ ] weather-worker (forecast)
- [ ] travel-worker (flights)
- [ ] finance-worker (prices/trades)
- [ ] shopping-worker (price compare)

## Phase 6: Security & Privacy
- [ ] crypto-worker (encryption/keys)
  - [ ] AES/RSA helpers, key storage
- [ ] audit-worker (scan)
  - [ ] SAST/dep‑audit runners
- [ ] vpn-worker (profiles)
- [ ] password-worker (vault integration)

## Phase 7: Multi‑Modal Interface
- [ ] Speech recognition
  - [ ] Streaming mic capture + VAD
- [ ] Text‑to‑speech
  - [ ] Local TTS voices + settings
- [ ] Wake word
  - [ ] Hotword engine + privacy toggle
- [ ] Screen analysis
  - [ ] Live screenshot hooks
- [ ] Camera integration
  - [ ] Device selection + capture
- [ ] Gesture recognition
  - [ ] Model selection + mapping
- [ ] Visual workflow builder
  - [ ] Drag‑drop nodes + state
- [ ] Real‑time collaboration
  - [ ] Presence + shared cursors
- [ ] Mobile companion
  - [ ] API + notification bridge

## Phase 8: Performance & Scalability
- [ ] Worker pool management
  - [ ] Queue + priority lanes
- [ ] Caching layer
  - [ ] Result cache with keys/TTL
- [ ] Load balancing
  - [ ] Task sharding across pools
- [ ] Learning system
  - [ ] Preference capture + ranking
- [ ] Context memory
  - [ ] Long‑term vector store
- [ ] Predictive actions
  - [ ] Next‑best‑action heuristics

## Success Metrics
- [ ] Define KPIs/dashboards (coverage, latency, reliability, satisfaction)
  - [ ] Instrumentation (timelines, errors)
  - [ ] Dashboard (Grafana/Metabase)
  - [ ] Baseline + targets per phase
