var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl, importMetaUrl;
var init_cjs_shims = __esm({
  "node_modules/tsup/assets/cjs_shims.js"() {
    getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.src || new URL("main.js", document.baseURI).href;
    importMetaUrl = /* @__PURE__ */ getImportMetaUrl();
  }
});

// src/shared/logger.ts
var import_pino, logger;
var init_logger = __esm({
  "src/shared/logger.ts"() {
    init_cjs_shims();
    import_pino = __toESM(require("pino"), 1);
    logger = (0, import_pino.default)({
      name: "local-agent",
      level: process.env.NODE_ENV === "production" ? "info" : "debug"
    });
  }
});

// src/agent/event_bus.ts
var import_node_events, eventBus;
var init_event_bus = __esm({
  "src/agent/event_bus.ts"() {
    init_cjs_shims();
    import_node_events = require("events");
    eventBus = new import_node_events.EventEmitter();
  }
});

// src/db.ts
function newId() {
  return "id-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
var import_better_sqlite3, import_node_path, import_node_fs, import_node_os, dataDir, overridePath, dbPath, sqliteDb, dbApi, db;
var init_db = __esm({
  "src/db.ts"() {
    init_cjs_shims();
    import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
    import_node_path = __toESM(require("path"), 1);
    import_node_fs = __toESM(require("fs"), 1);
    import_node_os = __toESM(require("os"), 1);
    init_event_bus();
    dataDir = import_node_path.default.join(import_node_os.default.homedir(), ".local-agent");
    overridePath = process.env.LOCAL_AGENT_DB_PATH;
    dbPath = overridePath ? import_node_path.default.resolve(overridePath) : import_node_path.default.join(dataDir, "agent.db");
    if (!import_node_fs.default.existsSync(dataDir)) import_node_fs.default.mkdirSync(dataDir, { recursive: true });
    sqliteDb = new import_better_sqlite3.default(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    status TEXT,
    created_at TEXT,
    finished_at TEXT
  );
  CREATE TABLE IF NOT EXISTS run_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    created_at TEXT,
    payload TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT,
    run_id TEXT,
    title TEXT,
    role TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT,
    PRIMARY KEY (id, run_id)
  );
  CREATE INDEX IF NOT EXISTS idx_run_events_run_id_id ON run_events(run_id, id);
  CREATE INDEX IF NOT EXISTS idx_tasks_run_id_id_status ON tasks(run_id, id, status);
`);
    dbApi = {
      createSession(title) {
        const id = newId();
        const created_at = (/* @__PURE__ */ new Date()).toISOString();
        sqliteDb.prepare("INSERT INTO sessions (id, title, created_at) VALUES (?, ?, ?)").run(id, title, created_at);
        return id;
      },
      createRun(sessionId) {
        const id = newId();
        const created_at = (/* @__PURE__ */ new Date()).toISOString();
        sqliteDb.prepare("INSERT INTO runs (id, session_id, status, created_at) VALUES (?, ?, ?, ?)").run(id, sessionId, "running", created_at);
        return id;
      },
      completeRun(runId) {
        const finished_at = (/* @__PURE__ */ new Date()).toISOString();
        sqliteDb.prepare("UPDATE runs SET status = ?, finished_at = ? WHERE id = ?").run("done", finished_at, runId);
        this.addRunEvent(runId, { type: "run_complete" });
      },
      addRunEvent(runId, payload, createdAtOverride) {
        const created_at = createdAtOverride ?? (/* @__PURE__ */ new Date()).toISOString();
        sqliteDb.prepare("INSERT INTO run_events (run_id, created_at, payload) VALUES (?, ?, ?)").run(runId, created_at, JSON.stringify(payload));
        eventBus.emit("event", { runId, created_at, payload });
      },
      updateTaskStatus(runId, taskId, status, meta) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const exists = sqliteDb.prepare("SELECT 1 FROM tasks WHERE id = ? AND run_id = ?").get(taskId, runId);
        if (!exists) {
          sqliteDb.prepare("INSERT INTO tasks (id, run_id, title, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(taskId, runId, (meta == null ? void 0 : meta.title) ?? "", (meta == null ? void 0 : meta.role) ?? "", status, now, now);
        } else {
          sqliteDb.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND run_id = ?").run(status, now, taskId, runId);
        }
        this.addRunEvent(runId, { type: "task_status", taskId, status });
      },
      getHistory(sessionId) {
        if (sessionId) {
          const runs = sqliteDb.prepare("SELECT * FROM runs WHERE session_id = ? ORDER BY created_at DESC").all(sessionId);
          const events = sqliteDb.prepare("SELECT * FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE session_id = ?) ORDER BY id ASC").all(sessionId);
          return { runs, events };
        } else {
          const runs = sqliteDb.prepare("SELECT * FROM runs ORDER BY created_at DESC").all();
          const events = sqliteDb.prepare("SELECT * FROM run_events ORDER BY id ASC").all();
          return { runs, events };
        }
      },
      getTaskResultsByRole(runId, role) {
        const rows = sqliteDb.prepare("SELECT payload FROM run_events WHERE run_id = ? ORDER BY id ASC").all(runId);
        const results = [];
        for (const r of rows) {
          try {
            const payload = JSON.parse(r.payload);
            if ((payload == null ? void 0 : payload.type) === "task_result" && (payload == null ? void 0 : payload.taskRole) === role) {
              results.push(payload.result);
            }
          } catch {
          }
        }
        return results;
      },
      pruneOldData(retentionDays) {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1e3).toISOString();
        sqliteDb.prepare("DELETE FROM run_events WHERE created_at < ?").run(cutoff);
        sqliteDb.prepare("DELETE FROM runs WHERE finished_at IS NOT NULL AND finished_at < ?").run(cutoff);
        sqliteDb.prepare("DELETE FROM sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM runs)").run();
        try {
          sqliteDb.prepare("VACUUM").run();
        } catch {
        }
      }
    };
    db = dbApi;
  }
});

// src/agent/workers/research.ts
var research_exports = {};
__export(research_exports, {
  spawnResearchAgent: () => spawnResearchAgent
});
async function spawnResearchAgent(ctx) {
  var _a, _b, _c, _d, _e, _f;
  const browser = await import_playwright.chromium.launch({
    headless: process.env.PLAYWRIGHT_VISIBLE === "1" ? false : true,
    args: ["--autoplay-policy=no-user-gesture-required"]
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    locale: "en-US"
  });
  let page = null;
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const cleanExtractedText = (input) => {
    const t = (input || "").replace(/\r\n/g, "\n");
    const lines = t.split("\n");
    const kept = [];
    const seen = /* @__PURE__ */ new Set();
    let totalChars = 0;
    for (let raw of lines) {
      let l = raw.trim();
      if (!l) continue;
      if (/^(?:[\-\–\—]\s*)?\[[xX\s]\]\s*/.test(l)) continue;
      if (/\[[xX\s]\]/.test(l) && l.length <= 80) continue;
      l = l.replace(/^[-•*\u2022\u25CF\u25E6\u2023\u2043]+\s*/, "");
      if (/^\[[xX\s]\]\s*/.test(l)) continue;
      const ll = l.toLowerCase();
      const hasAlphaRatio = l.replace(/[^a-z]/gi, "").length / Math.max(l.length, 1);
      if (l.length <= 20) {
        const smallDrops = /* @__PURE__ */ new Set(["us", "uk", "share", "news", "opinion", "sport", "culture", "lifestyle", "companies", "summary"]);
        if (smallDrops.has(ll)) continue;
      }
      if (/^keyboard shortcuts/i.test(l)) continue;
      if (/^(play\/pause|increase volume|decrease volume|seek forward|captions)\b/i.test(l)) continue;
      if (/^(subtitle settings|automated captions)\b/i.test(l)) continue;
      if (/(font color|font opacity|font size)\b/i.test(l)) continue;
      if (/^(fullscreen|exit fullscreen|mute|unmute)\b/i.test(l)) continue;
      if (/caption size/i.test(l)) continue;
      if (/^next up\b/i.test(l)) continue;
      const dropKeywords = [
        "cookie",
        "cookies",
        "privacy",
        "terms of",
        "adchoices",
        "advert",
        "advertisement",
        "sponsored",
        "subscribe",
        "newsletter",
        "sign in",
        "sign up",
        "log in",
        "sign out",
        "view profile",
        "copyright",
        "skip to",
        "navigation",
        "sidebar",
        "menu",
        "about",
        "contact",
        "manage preferences",
        "report this ad",
        "policies",
        "our network",
        "more",
        "close",
        "back",
        "search",
        "us-en",
        "edition",
        "popular",
        "recommended reading",
        "issues delivered",
        "try a single issue",
        "advertising",
        "quick links",
        "explore content",
        "publish with us",
        "enjoying our latest content",
        "login or create an account",
        "access the most recent journalism",
        "authors and affiliations",
        "rights and permissions",
        "corresponding author",
        "competing interests",
        "doi:",
        "references",
        "press shift question mark",
        "volume 0%",
        "support the guardian",
        "fund the free press",
        "support our journalism",
        "subtitle settings",
        "automated captions",
        "font color",
        "font opacity",
        "font size",
        "font family",
        "character edge",
        "edge color",
        "window color",
        "window opacity",
        "reset"
      ];
      if (dropKeywords.some((k) => ll.includes(k))) continue;
      if (/^(?:white|black|red|green|blue|yellow|magenta|cyan|yel)(?:\s+(?:white|black|red|green|blue|yellow|magenta|cyan|yel))*$/i.test(l)) continue;
      if (/^(?:\d{1,3}%\s*){2,}$/i.test(l)) continue;
      if (/^(?:arial|courier|georgia|impact|lucida console|tahoma|times new roman|trebuchet ms|verdana|helvetica|monospace|sans-serif|serif)(?:\s+(?:arial|courier|georgia|impact|lucida console|tahoma|times new roman|trebuchet ms|verdana|helvetica|monospace|sans-serif|serif))*$/i.test(l)) continue;
      if (l.startsWith("[") || /\]\(/.test(l)) continue;
      if (/^https?:\/\//i.test(l)) continue;
      if (l.length < 20 && hasAlphaRatio < 0.5) continue;
      if (/^[A-Za-z]$/.test(l)) continue;
      if (l.length <= 10 && /^(white|black|red|green|blue|yellow|arial|none)$/i.test(l)) continue;
      const norm = l.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      kept.push(l);
      totalChars += l.length + 1;
      if (totalChars >= 16e3) break;
      if (kept.length >= 2e3) break;
    }
    return kept.join("\n");
  };
  const domainFromUrl = (href) => {
    try {
      return new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return "";
    }
  };
  const normalizeTitle = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const extractSnippets = (fullText, query, maxSnippets = 3) => {
    try {
      const text = (fullText || "").replace(/\r\n/g, "\n");
      const paras = text.split(/\n\s*\n+/);
      const q = (query || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
      const qWords = Array.from(new Set(q.split(/\s+/).filter((w) => w.length > 2)));
      const scored = [];
      for (let i = 0; i < paras.length; i++) {
        const p = paras[i];
        const lower = p.toLowerCase();
        let score = 0;
        for (const w of qWords) if (lower.includes(w)) score += 1;
        if (score > 0) scored.push({ i, score, p });
      }
      scored.sort((a, b) => b.score - a.score);
      const chosen = scored.slice(0, maxSnippets);
      const windowed = [];
      for (const c of chosen) {
        const before = paras[c.i - 1] ? paras[c.i - 1] + "\n" : "";
        const after = paras[c.i + 1] ? "\n" + paras[c.i + 1] : "";
        const snippet = (before + c.p + after).trim();
        windowed.push(snippet.length > 1200 ? snippet.slice(0, 1200) + "\u2026" : snippet);
      }
      return windowed;
    } catch {
      return [];
    }
  };
  const domainWeight = {
    "reuters.com": 3,
    "apnews.com": 3,
    "bloomberg.com": 2.6,
    "theverge.com": 2.2,
    "wired.com": 2.2,
    "nature.com": 2.5,
    "arxiv.org": 2.4,
    "devblogs.microsoft.com": 2,
    "microsoft.com": 1.8,
    "openai.com": 2.4,
    "openai.com/blog": 2.6,
    "blog.google": 2.4,
    "blog.google/technology/ai": 2.6,
    "anthropic.com": 2.2,
    "ai.googleblog.com": 2.4
  };
  const urlRecencyDays = /* @__PURE__ */ new Map();
  const rankTargets = (items) => {
    const scored = items.map((it) => {
      const d = domainFromUrl(it.url);
      const w = domainWeight[d] ?? 1;
      const kw = /\b(release|launch|announc|latest|update|roadmap|news)\b/i.test(it.title) ? 0.3 : 0;
      const rec = urlRecencyDays.get(it.url);
      const recBonus = rec == null ? 0 : rec < 3 ? 0.8 : rec < 7 ? 0.5 : rec < 30 ? 0.2 : 0;
      return { it, score: w + kw + recBonus };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.it);
  };
  const limitPerDomain = (items, perDomain) => {
    const count = /* @__PURE__ */ new Map();
    const out = [];
    for (const it of items) {
      const d = domainFromUrl(it.url);
      const c = count.get(d) ?? 0;
      if (c >= perDomain) continue;
      count.set(d, c + 1);
      out.push(it);
    }
    return out;
  };
  try {
    page = await context.newPage();
    db.addRunEvent(ctx.runId, { type: "research_start", taskId: ctx.task.id, deep: Boolean(ctx.deep) });
    if ((_a = ctx.signal) == null ? void 0 : _a.aborted) {
      db.addRunEvent(ctx.runId, { type: "research_cancelled", taskId: ctx.task.id });
      return { cancelled: true };
    }
    const deriveQuery = (text) => {
      const original = text.trim();
      const mQuote = original.match(/["“”](.+?)["“”]/);
      if (mQuote == null ? void 0 : mQuote[1]) return mQuote[1].trim();
      const patts = [
        /search the web for\s+(.+?)(?:\.|\band\b|\bthen\b|\bto\b|$)/i,
        /latest\s+(.+?)\s+news/i,
        /about\s+(.+?)(?:\.|\band\b|\bthen\b|$)/i
      ];
      for (const r of patts) {
        const m = original.match(r);
        if (m == null ? void 0 : m[1]) return m[1].trim();
      }
      const cut = original.split(/\b(?:and|then|to|so that|write|summarize|summary|file|save)\b/i)[0];
      let q = (cut || original).trim();
      q = q.replace(/^the\s+/i, "");
      return q;
    };
    const rawQ = ctx.query && ctx.query.trim().length > 0 ? ctx.query : ctx.task.description;
    const searchQuery = deriveQuery(rawQ);
    db.addRunEvent(ctx.runId, { type: "research_query", taskId: ctx.task.id, query: searchQuery });
    const disallowHosts = /* @__PURE__ */ new Set(["hackertab.dev", "twitter.com", "x.com"]);
    const normHost = (h) => h.replace(/^www\./i, "").toLowerCase();
    const seenUrls = /* @__PURE__ */ new Set();
    const targets = [];
    const seenTitleKeys = /* @__PURE__ */ new Set();
    const tavilyKey = process.env.TAVILY_API_KEY;
    db.addRunEvent(ctx.runId, { type: "env_info", taskId: ctx.task.id, tavily: Boolean(tavilyKey) });
    if (tavilyKey) {
      db.addRunEvent(ctx.runId, { type: "search_vendor", taskId: ctx.task.id, vendor: "tavily", query: searchQuery });
      const maxResults = ctx.deep ? 15 : 8;
      const queries = [searchQuery];
      if (ctx.deep) {
        queries.push(
          `${searchQuery} site:devblogs.microsoft.com`,
          `${searchQuery} release notes`,
          `${searchQuery} roadmap`
        );
      }
      const isNewsy = /\b(latest|news|today|this week|this month)\b/i.test(searchQuery);
      const excludeDomains = [
        "hackertab.dev",
        "twitter.com",
        "x.com",
        "medium.com",
        "linkedin.com",
        "facebook.com",
        "youtube.com",
        "instagram.com",
        "pinterest.com",
        "reddit.com",
        "roboticsandautomationnews.com",
        "quora.com",
        "stackexchange.com",
        "stack overflow",
        "news.ycombinator.com"
      ];
      const tavilyCollected = [];
      for (const q of queries) {
        try {
          const doFetch = globalThis.fetch ?? (await import("node-fetch")).default;
          const resp = await doFetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tavilyKey}` },
            body: JSON.stringify({
              query: q,
              include_answer: false,
              search_depth: ctx.deep ? "advanced" : "basic",
              max_results: maxResults,
              auto_parameters: true,
              include_raw_content: true,
              topic: isNewsy ? "news" : "general",
              days: isNewsy ? 7 : void 0,
              exclude_domains: excludeDomains
            })
          });
          if (!resp.ok) {
            const msg = await resp.text().catch(() => "");
            db.addRunEvent(ctx.runId, { type: "search_error", taskId: ctx.task.id, vendor: "tavily", status: resp.status, body: msg });
            continue;
          }
          const data = await resp.json();
          const results = Array.isArray(data == null ? void 0 : data.results) ? data.results : [];
          for (const r of results) {
            const href = r == null ? void 0 : r.url;
            const title = ((r == null ? void 0 : r.title) ?? "").toString();
            if (!href || !title || !href.startsWith("http")) continue;
            try {
              const u = new URL(href);
              if (disallowHosts.has(normHost(u.hostname))) continue;
            } catch {
            }
            if (seenUrls.has(href)) continue;
            const key = normalizeTitle(title);
            if (seenTitleKeys.has(key)) continue;
            seenTitleKeys.add(key);
            seenUrls.add(href);
            targets.push({ title, url: href });
            try {
              const pd = ((r == null ? void 0 : r.published_date) || (r == null ? void 0 : r.date) || "").toString();
              if (pd) {
                const d = new Date(pd);
                if (!isNaN(d.getTime())) {
                  const days = Math.max(0, (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24));
                  urlRecencyDays.set(href, days);
                }
              }
            } catch {
            }
            if (typeof (r == null ? void 0 : r.raw_content) === "string" && r.raw_content.trim().length > 200) {
              tavilyCollected.push({ title, url: href, raw: r.raw_content });
            }
            if (targets.length >= (ctx.deep ? 12 : 5)) break;
          }
          if (targets.length >= (ctx.deep ? 12 : 5)) break;
        } catch (err) {
          logger.warn({ err }, "Tavily search failed, will fallback to manual search if needed");
          db.addRunEvent(ctx.runId, { type: "search_error", taskId: ctx.task.id, vendor: "tavily", error: String((err == null ? void 0 : err.message) ?? err) });
        }
      }
      const tavilyDeferredLocal2 = [];
      if (tavilyCollected.length > 0) {
        for (const item of tavilyCollected.slice(0, ctx.deep ? 12 : 5)) {
          if (typeof item.raw === "string" && item.raw.trim().length > 0) {
            tavilyDeferredLocal2.push({ title: item.title, url: item.url, raw: item.raw.slice(0, 16e3) });
          }
        }
      }
    }
    if (targets.length === 0) {
      db.addRunEvent(ctx.runId, { type: "search_vendor", taskId: ctx.task.id, vendor: "duckduckgo_html", query: searchQuery });
      const ddgBase = "https://duckduckgo.com/html/?kz=1&q=";
      const baseQueries = [searchQuery];
      const moreQueries = ctx.deep ? [
        `${searchQuery} site:devblogs.microsoft.com`,
        `${searchQuery} TypeScript release notes`,
        `TypeScript roadmap latest`,
        `TypeScript 5 news`
      ] : [];
      const allQueries = [...baseQueries, ...moreQueries];
      for (const sub of allQueries) {
        const url = ddgBase + encodeURIComponent(sub);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("domcontentloaded");
        const anchors = await page.locator("a.result__a, a.result__a.js-result-title-link").all();
        for (const a of anchors) {
          const href = await a.getAttribute("href");
          const text = ((_b = await a.textContent()) == null ? void 0 : _b.trim()) || "";
          if (!href || !text || !href.startsWith("http")) continue;
          try {
            const u = new URL(href);
            if (disallowHosts.has(normHost(u.hostname))) continue;
          } catch {
          }
          if (seenUrls.has(href)) continue;
          const key = normalizeTitle(text);
          if (seenTitleKeys.has(key)) continue;
          seenTitleKeys.add(key);
          seenUrls.add(href);
          targets.push({ title: text, url: href });
          if (targets.length >= (ctx.deep ? 12 : 5)) break;
        }
        if (targets.length >= (ctx.deep ? 12 : 5)) break;
      }
      if (targets.length === 0) {
        db.addRunEvent(ctx.runId, { type: "search_no_results", taskId: ctx.task.id, vendor: "duckduckgo_html", query: searchQuery });
      }
    }
    if (targets.length === 0) {
      try {
        db.addRunEvent(ctx.runId, { type: "search_vendor", taskId: ctx.task.id, vendor: "bing_news", query: searchQuery });
        await page.goto("https://www.bing.com/news/search?q=" + encodeURIComponent(searchQuery));
        await page.waitForLoadState("domcontentloaded");
        const anchors = await page.locator("a.title, h2 a").all();
        for (const a of anchors) {
          const href = await a.getAttribute("href");
          const text = ((_c = await a.textContent()) == null ? void 0 : _c.trim()) || "";
          if (!href || !text || !href.startsWith("http")) continue;
          try {
            const u = new URL(href);
            if (disallowHosts.has(normHost(u.hostname))) continue;
          } catch {
          }
          if (seenUrls.has(href)) continue;
          seenUrls.add(href);
          targets.push({ title: text, url: href });
          if (targets.length >= (ctx.deep ? 12 : 5)) break;
        }
      } catch (err) {
        db.addRunEvent(ctx.runId, { type: "search_error", taskId: ctx.task.id, vendor: "bing_news", error: String((err == null ? void 0 : err.message) ?? err) });
      }
    }
    if (targets.length === 0) {
      try {
        db.addRunEvent(ctx.runId, { type: "search_vendor", taskId: ctx.task.id, vendor: "bing", query: searchQuery });
        await page.goto("https://www.bing.com/search?q=" + encodeURIComponent(searchQuery));
        await page.waitForLoadState("domcontentloaded");
        const anchors = await page.locator("li.b_algo h2 a").all();
        for (const a of anchors) {
          const href = await a.getAttribute("href");
          const text = ((_d = await a.textContent()) == null ? void 0 : _d.trim()) || "";
          if (!href || !text || !href.startsWith("http")) continue;
          try {
            const u = new URL(href);
            if (disallowHosts.has(normHost(u.hostname))) continue;
          } catch {
          }
          if (seenUrls.has(href)) continue;
          seenUrls.add(href);
          targets.push({ title: text, url: href });
          if (targets.length >= (ctx.deep ? 12 : 5)) break;
        }
      } catch (err) {
        db.addRunEvent(ctx.runId, { type: "search_error", taskId: ctx.task.id, vendor: "bing", error: String((err == null ? void 0 : err.message) ?? err) });
      }
    }
    if (targets.length === 0) {
      const qLower = searchQuery.toLowerCase();
      const seeds = [];
      if (qLower.includes("typescript")) {
        seeds.push(
          { title: "TypeScript Blog", url: "https://devblogs.microsoft.com/typescript/" },
          { title: "TypeScript Releases (GitHub)", url: "https://github.com/microsoft/TypeScript/releases" },
          { title: "TypeScript Release Notes Overview", url: "https://www.typescriptlang.org/docs/handbook/release-notes/overview.html" }
        );
      }
      for (const s of seeds) {
        if (!seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          targets.push(s);
        }
      }
      if (seeds.length > 0) {
        db.addRunEvent(ctx.runId, { type: "search_seeded", taskId: ctx.task.id, count: seeds.length });
      }
    }
    const baseDir = import_node_path2.default.join(import_node_os2.default.homedir(), ".local-agent");
    if (!import_node_fs2.default.existsSync(baseDir)) import_node_fs2.default.mkdirSync(baseDir, { recursive: true });
    const shotPath = import_node_path2.default.join(baseDir, `screenshot-${Date.now()}.png`);
    try {
      await page.screenshot({ path: shotPath, fullPage: true });
    } catch {
    }
    const articles = [];
    const aggregateParts = [];
    let rankedTargets = rankTargets(targets);
    rankedTargets = limitPerDomain(rankedTargets, ctx.deep ? 3 : 2);
    const limit = ctx.deep ? 12 : 5;
    const finalTargets = rankedTargets.slice(0, limit);
    if (finalTargets.length !== targets.length) {
      db.addRunEvent(ctx.runId, { type: "targets_ranked", taskId: ctx.task.id, before: targets.length, after: finalTargets.length });
    }
    if (typeof tavilyDeferredLocal !== "undefined" && tavilyDeferredLocal.length > 0) {
      const baseDir2 = import_node_path2.default.join(import_node_os2.default.homedir(), ".local-agent");
      for (const item of tavilyDeferredLocal) {
        try {
          const cleanedRaw = cleanExtractedText(item.raw);
          const snippets = extractSnippets(cleanedRaw, searchQuery);
          const best = snippets.length > 0 ? snippets.join("\n\n") : cleanedRaw.slice(0, 1200);
          const md = `# ${item.title}
${item.url}

> ${best.replace(/\n/g, "\n> ")}
`;
          const f = import_node_path2.default.join(baseDir2, `snippet-${slug(item.title)}-${Date.now()}.md`);
          import_node_fs2.default.writeFileSync(f, md, "utf8");
          articles.push({ title: item.title, url: item.url, path: f, snippet: best });
          aggregateParts.push(md + "\n---\n\n");
        } catch {
        }
      }
      db.addRunEvent(ctx.runId, { type: "extract_result", taskId: ctx.task.id, count: articles.length });
    }
    let crawled = false;
    if (tavilyKey && finalTargets.length > 0 && articles.length < (ctx.deep ? 6 : 3)) {
      try {
        const doFetch = globalThis.fetch ?? (await import("node-fetch")).default;
        const resp = await doFetch("https://api.tavily.com/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tavilyKey}` },
          body: JSON.stringify({ urls: finalTargets.map((t) => t.url), include_images: false })
        });
        const data = await resp.json();
        const results = Array.isArray(data == null ? void 0 : data.results) ? data.results : [];
        for (const r of results) {
          const url = (r == null ? void 0 : r.url) || (r == null ? void 0 : r.source) || "";
          const title = (r == null ? void 0 : r.title) || ((_e = finalTargets.find((t) => t.url === url)) == null ? void 0 : _e.title) || url;
          const text = cleanExtractedText(((r == null ? void 0 : r.content) || (r == null ? void 0 : r.text) || (r == null ? void 0 : r.markdown) || "").toString());
          if (url && text.trim().length > 200) {
            const snippets = extractSnippets(text, searchQuery);
            const best = snippets.length > 0 ? snippets.join("\n\n") : text.slice(0, 1200);
            const md = `# ${title}
${url}

> ${best.replace(/\n/g, "\n> ")}
`;
            const f = import_node_path2.default.join(baseDir, `snippet-${slug(title)}-${Date.now()}.md`);
            import_node_fs2.default.writeFileSync(f, md, "utf8");
            articles.push({ title, url, path: f, snippet: best });
            aggregateParts.push(md + "\n---\n\n");
          }
        }
        crawled = articles.length > 0;
      } catch (err) {
        logger.warn({ err }, "Tavily crawl failed; will fall back to Playwright");
      }
    }
    if (tavilyKey && finalTargets.length > 0 && articles.length < (ctx.deep ? 6 : 3)) {
      try {
        const doFetch = globalThis.fetch ?? (await import("node-fetch")).default;
        const resp = await doFetch("https://api.tavily.com/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tavilyKey}` },
          body: JSON.stringify({ urls: finalTargets.map((t) => t.url).slice(0, ctx.deep ? 12 : 5), extract_depth: ctx.deep ? "advanced" : "basic" })
        });
        if (resp.ok) {
          const data = await resp.json();
          const results = Array.isArray(data == null ? void 0 : data.results) ? data.results : [];
          for (const r of results) {
            const url = (r == null ? void 0 : r.url) || "";
            const title = ((_f = finalTargets.find((t) => t.url === url)) == null ? void 0 : _f.title) || url;
            const text = cleanExtractedText(((r == null ? void 0 : r.raw_content) || (r == null ? void 0 : r.content) || "").toString());
            if (url && text.trim().length > 200) {
              const snippets = extractSnippets(text, searchQuery);
              const best = snippets.length > 0 ? snippets.join("\n\n") : text.slice(0, 1200);
              const md = `# ${title}
${url}

> ${best.replace(/\n/g, "\n> ")}
`;
              const f = import_node_path2.default.join(baseDir, `snippet-${slug(title)}-${Date.now()}.md`);
              import_node_fs2.default.writeFileSync(f, md, "utf8");
              articles.push({ title, url, path: f, snippet: best });
              aggregateParts.push(md + "\n---\n\n");
            }
          }
          db.addRunEvent(ctx.runId, { type: "extract_result", taskId: ctx.task.id, count: results.length });
        } else {
          const msg = await resp.text().catch(() => "");
          db.addRunEvent(ctx.runId, { type: "extract_error", taskId: ctx.task.id, status: resp.status, body: msg });
        }
      } catch (err) {
        db.addRunEvent(ctx.runId, { type: "extract_error", taskId: ctx.task.id, error: String((err == null ? void 0 : err.message) ?? err) });
      }
    }
    if (!crawled) {
      for (const t of finalTargets) {
        try {
          await page.goto(t.url, { waitUntil: "domcontentloaded" });
          const text = await page.evaluate(() => {
            const pick = () => {
              var _a2;
              const article = document.querySelector("article");
              if (article) return article.innerText;
              const main = document.querySelector("main");
              if (main) return main.innerText;
              const sel = document.querySelector('div[id*="content"], div[class*="content"], section[id*="content"], section[class*="content"]');
              if (sel) return sel.innerText;
              return ((_a2 = document.body) == null ? void 0 : _a2.innerText) || "";
            };
            const maxLen = 16e3;
            let inner = pick() || "";
            if (inner.length > maxLen) inner = inner.slice(0, maxLen);
            return inner;
          });
          const cleaned = cleanExtractedText(text);
          const snippets = extractSnippets(cleaned, searchQuery);
          const best = snippets.length > 0 ? snippets.join("\n\n") : cleaned.slice(0, 1200);
          const md = `# ${t.title}
${t.url}

> ${best.replace(/\n/g, "\n> ")}
`;
          const f = import_node_path2.default.join(baseDir, `snippet-${slug(t.title)}-${Date.now()}.md`);
          import_node_fs2.default.writeFileSync(f, md, "utf8");
          articles.push({ title: t.title, url: t.url, path: f, snippet: best });
          aggregateParts.push(md + "\n---\n\n");
        } catch (err) {
          logger.warn({ err }, "Failed to scrape target");
        }
      }
    }
    const aggregatePath = import_node_path2.default.join(baseDir, `research-aggregate-${Date.now()}.txt`);
    import_node_fs2.default.writeFileSync(aggregatePath, aggregateParts.join("\n"), "utf8");
    db.addRunEvent(ctx.runId, {
      type: "research_result",
      taskId: ctx.task.id,
      query: searchQuery,
      targets: finalTargets,
      screenshot: shotPath,
      articles,
      aggregatePath
    });
    return { query: searchQuery, targets: finalTargets, screenshot: shotPath, articles, aggregatePath };
  } finally {
    try {
      await (page == null ? void 0 : page.close());
    } catch {
    }
    try {
      await (context == null ? void 0 : context.close());
    } catch {
    }
    try {
      await (browser == null ? void 0 : browser.close());
    } catch {
    }
  }
}
var import_playwright, import_node_path2, import_node_os2, import_node_fs2;
var init_research = __esm({
  "src/agent/workers/research.ts"() {
    init_cjs_shims();
    import_playwright = require("playwright");
    import_node_path2 = __toESM(require("path"), 1);
    import_node_os2 = __toESM(require("os"), 1);
    import_node_fs2 = __toESM(require("fs"), 1);
    init_logger();
    init_db();
  }
});

// src/agent/workers/ocr.ts
function ensureCacheDir() {
  if (!import_node_fs3.default.existsSync(OCR_CACHE_DIR)) {
    import_node_fs3.default.mkdirSync(OCR_CACHE_DIR, { recursive: true });
  }
}
function getCacheKey(filePath) {
  const stats = import_node_fs3.default.statSync(filePath);
  const content = `${filePath}:${stats.mtime.getTime()}:${stats.size}`;
  return import_node_crypto.default.createHash("sha256").update(content).digest("hex");
}
function getCachedResult(filePath) {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(filePath);
    const cachePath = import_node_path3.default.join(OCR_CACHE_DIR, `${cacheKey}.json`);
    if (import_node_fs3.default.existsSync(cachePath)) {
      const cached = JSON.parse(import_node_fs3.default.readFileSync(cachePath, "utf8"));
      return cached;
    }
  } catch (error) {
    console.warn("Failed to read OCR cache:", error);
  }
  return null;
}
function saveCachedResult(filePath, result) {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(filePath);
    const cachePath = import_node_path3.default.join(OCR_CACHE_DIR, `${cacheKey}.json`);
    import_node_fs3.default.writeFileSync(cachePath, JSON.stringify(result, null, 2));
  } catch (error) {
    console.warn("Failed to save OCR cache:", error);
  }
}
async function testSwiftAvailability() {
  return new Promise((resolve) => {
    console.log(`[OCR] Testing Swift availability...`);
    const child = (0, import_node_child_process.spawn)("xcrun", ["swift", "--version"], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.on("close", (code) => {
      console.log(`[OCR] Swift version check exit code: ${code}`);
      console.log(`[OCR] Swift version output: ${output}`);
      resolve(code === 0);
    });
    child.on("error", (error) => {
      console.log(`[OCR] Swift not available: ${error.message}`);
      resolve(false);
    });
  });
}
async function testVisionFramework(ctx) {
  return new Promise((resolve) => {
    if (ctx) {
      db.addRunEvent(ctx.runId, {
        type: "ocr_debug",
        taskId: ctx.task.id,
        message: `[OCR] Testing Vision framework...`
      });
    }
    const visionTestScript = `
import Foundation
import Vision

// Simple test to see if Vision framework loads
print("Vision framework test started")
let request = VNRecognizeTextRequest()
print("Vision framework test completed successfully")
`;
    const tempDir = import_node_os3.default.tmpdir();
    const testScriptPath = import_node_path3.default.join(tempDir, `vision-test-${Date.now()}.swift`);
    try {
      import_node_fs3.default.writeFileSync(testScriptPath, visionTestScript);
      const child = (0, import_node_child_process.spawn)("xcrun", ["swift", testScriptPath], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_debug",
            taskId: ctx.task.id,
            message: `[OCR] Vision framework test timed out`
          });
        }
        resolve(false);
      }, 5e3);
      child.on("close", (code) => {
        clearTimeout(timeout);
        try {
          import_node_fs3.default.unlinkSync(testScriptPath);
        } catch {
        }
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_debug",
            taskId: ctx.task.id,
            message: `[OCR] Vision test result: code=${code}, stdout="${stdout.trim()}", stderr="${stderr.trim()}"`
          });
        }
        resolve(code === 0 && stdout.includes("Vision framework test completed"));
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        try {
          import_node_fs3.default.unlinkSync(testScriptPath);
        } catch {
        }
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_debug",
            taskId: ctx.task.id,
            message: `[OCR] Vision test error: ${error.message}`
          });
        }
        resolve(false);
      });
    } catch (error) {
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_debug",
          taskId: ctx.task.id,
          message: `[OCR] Vision test setup failed: ${error}`
        });
      }
      resolve(false);
    }
  });
}
async function extractTextWithTesseract(imagePath, ctx) {
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: "ocr_debug",
      taskId: ctx.task.id,
      message: `[OCR] Using Tesseract.js fallback for ${import_node_path3.default.basename(imagePath)}`
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2e4);
  try {
    const { data } = await import_tesseract.default.recognize(imagePath, "eng", {
      logger: (m) => {
        if (ctx && (m == null ? void 0 : m.status)) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_debug",
            taskId: ctx.task.id,
            message: `[OCR/Tesseract] ${m.status}${m.progress ? ` ${Math.round(m.progress * 100)}%` : ""}`
          });
        }
      }
    });
    const text = (data == null ? void 0 : data.text) || "";
    const confidence = Math.max(0, Math.min(1, ((data == null ? void 0 : data.confidence) ?? 50) / 100));
    return {
      filePath: imagePath,
      text,
      confidence
    };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        filePath: imagePath,
        text: "",
        confidence: 0,
        error: "OCR timeout (tesseract)"
      };
    }
    return {
      filePath: imagePath,
      text: "",
      confidence: 0,
      error: `Tesseract error: ${(error == null ? void 0 : error.message) || String(error)}`
    };
  } finally {
    clearTimeout(timeout);
  }
}
function isFileSizeReasonable(filePath) {
  try {
    const stats = import_node_fs3.default.statSync(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    return fileSizeInMB <= 10;
  } catch {
    return false;
  }
}
async function extractTextFromImage(imagePath, ctx) {
  console.log(`[OCR] Starting OCR for: ${imagePath}`);
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: "ocr_debug",
      taskId: ctx.task.id,
      message: `[OCR] Starting OCR for: ${import_node_path3.default.basename(imagePath)}`
    });
  }
  const cached = getCachedResult(imagePath);
  if (cached) {
    console.log(`[OCR] Using cached result for: ${imagePath}`);
    if (ctx) {
      db.addRunEvent(ctx.runId, {
        type: "ocr_debug",
        taskId: ctx.task.id,
        message: `[OCR] Using cached result`
      });
    }
    return cached;
  }
  console.log(`[OCR] No cache found, proceeding with OCR for: ${imagePath}`);
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: "ocr_debug",
      taskId: ctx.task.id,
      message: `[OCR] No cache found, proceeding with OCR`
    });
  }
  return new Promise((resolve) => {
    var _a;
    const swiftScript = `
import Foundation
import Vision
import AppKit

func downscaledCGImage(from image: NSImage, maxDim: CGFloat) -> CGImage? {
    let originalSize = image.size
    let maxSide = max(originalSize.width, originalSize.height)
    let scale: CGFloat = maxSide > maxDim ? (maxDim / maxSide) : 1.0
    let targetSize = NSSize(width: floor(originalSize.width * scale), height: floor(originalSize.height * scale))
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(targetSize.width),
        pixelsHigh: Int(targetSize.height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    }
    rep.size = targetSize
    NSGraphicsContext.saveGraphicsState()
    if let ctx = NSGraphicsContext(bitmapImageRep: rep) {
        NSGraphicsContext.current = ctx
        NSColor.clear.set()
        NSRect(origin: .zero, size: targetSize).fill()
        image.draw(in: NSRect(origin: .zero, size: targetSize), from: NSRect(origin: .zero, size: originalSize), operation: .copy, fraction: 1.0)
        ctx.flushGraphics()
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.cgImage
}

func extractText(from imagePath: String) {
    guard let image = NSImage(contentsOfFile: imagePath) else {
        let result = ["error": "Failed to load image", "text": "", "confidence": 0] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
        return
    }

    let cgImage = downscaledCGImage(from: image, maxDim: 1600) ?? image.cgImage(forProposedRect: nil, context: nil, hints: nil)
    guard let finalImage = cgImage else {
        let result = ["error": "Failed to convert to CGImage", "text": "", "confidence": 0] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
        return
    }

    let request = VNRecognizeTextRequest { (request, error) in
        if let error = error {
            let result = ["error": error.localizedDescription, "text": "", "confidence": 0] as [String : Any]
            let jsonData = try! JSONSerialization.data(withJSONObject: result)
            print(String(data: jsonData, encoding: .utf8)!)
            return
        }

        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            let result = ["error": "No text found", "text": "", "confidence": 0] as [String : Any]
            let jsonData = try! JSONSerialization.data(withJSONObject: result)
            print(String(data: jsonData, encoding: .utf8)!)
            return
        }

        var allText = ""
        var totalConfidence: Float = 0
        var textCount = 0

        for observation in observations {
            guard let topCandidate = observation.topCandidates(1).first else { continue }
            allText += topCandidate.string + "\\n"
            totalConfidence += topCandidate.confidence
            textCount += 1
        }

        let avgConfidence = textCount > 0 ? totalConfidence / Float(textCount) : 0
        let result = [
            "text": allText.trimmingCharacters(in: .whitespacesAndNewlines),
            "confidence": avgConfidence,
            "filePath": imagePath
        ] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
    }

    request.recognitionLevel = .fast
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.015
    request.maximumCandidates = 1
    request.recognitionLanguages = ["en-US"]

    let handler = VNImageRequestHandler(cgImage: finalImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        let result = ["error": error.localizedDescription, "text": "", "confidence": 0] as [String : Any]
        let jsonData = try! JSONSerialization.data(withJSONObject: result)
        print(String(data: jsonData, encoding: .utf8)!)
    }
}

// Get command line argument
guard CommandLine.arguments.count > 1 else {
    let result = ["error": "No image path provided", "text": "", "confidence": 0] as [String : Any]
    let jsonData = try! JSONSerialization.data(withJSONObject: result)
    print(String(data: jsonData, encoding: .utf8)!)
    exit(1)
}

let imagePath = CommandLine.arguments[1]
extractText(from: imagePath)

// Keep the process alive for async completion
RunLoop.main.run()
`;
    const tempDir = import_node_os3.default.tmpdir();
    const scriptPath = import_node_path3.default.join(tempDir, `ocr-${Date.now()}.swift`);
    try {
      console.log(`[OCR] Creating Swift script at: ${scriptPath}`);
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_debug",
          taskId: ctx.task.id,
          message: `[OCR] Creating Swift script`
        });
      }
      import_node_fs3.default.writeFileSync(scriptPath, swiftScript);
      console.log(`[OCR] Swift script created successfully`);
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_debug",
          taskId: ctx.task.id,
          message: `[OCR] Swift script created successfully`
        });
      }
      console.log(`[OCR] Executing Swift script: swift ${scriptPath} ${imagePath}`);
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_debug",
          taskId: ctx.task.id,
          message: `[OCR] Executing Swift script`
        });
      }
      const child = (0, import_node_child_process.spawn)("xcrun", ["swift", scriptPath, imagePath], {
        stdio: ["ignore", "pipe", "pipe"]
      });
      console.log(`[OCR] Swift process spawned with PID: ${child.pid}`);
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_debug",
          taskId: ctx.task.id,
          message: `[OCR] Swift process spawned with PID: ${child.pid}`
        });
      }
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[OCR] Swift stdout: ${output}`);
        stdout += output;
      });
      child.stderr.on("data", (data) => {
        const error = data.toString();
        console.log(`[OCR] Swift stderr: ${error}`);
        stderr += error;
      });
      const timeout = setTimeout(() => {
        console.log(`[OCR] TIMEOUT: Killing Swift process ${child.pid} after 10 seconds`);
        child.kill("SIGKILL");
        console.log(`[OCR] Process killed due to timeout`);
        resolve({
          filePath: imagePath,
          text: "",
          confidence: 0,
          error: "OCR timeout (10s limit exceeded)"
        });
      }, 1e4);
      (_a = ctx == null ? void 0 : ctx.signal) == null ? void 0 : _a.addEventListener("abort", () => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      }, { once: true });
      child.on("close", (code) => {
        console.log(`[OCR] Swift process ${child.pid} closed with code: ${code}`);
        clearTimeout(timeout);
        try {
          import_node_fs3.default.unlinkSync(scriptPath);
          console.log(`[OCR] Cleaned up temporary script: ${scriptPath}`);
        } catch (cleanupError) {
          console.log(`[OCR] Failed to cleanup script: ${cleanupError}`);
        }
        if (code !== 0) {
          console.log(`[OCR] Swift execution failed with code ${code}`);
          console.log(`[OCR] stderr output: ${stderr}`);
          console.log(`[OCR] stdout output: ${stdout}`);
          const result = {
            filePath: imagePath,
            text: "",
            confidence: 0,
            error: stderr || `Swift execution failed with exit code ${code}`
          };
          resolve(result);
          return;
        }
        try {
          const output = stdout.trim();
          console.log(`[OCR] Raw stdout output: "${output}"`);
          if (!output) {
            console.log(`[OCR] No output from Swift script`);
            const result2 = {
              filePath: imagePath,
              text: "",
              confidence: 0,
              error: "No output from OCR"
            };
            resolve(result2);
            return;
          }
          console.log(`[OCR] Attempting to parse JSON output`);
          const parsed = JSON.parse(output);
          console.log(`[OCR] Parsed JSON:`, parsed);
          const result = {
            filePath: imagePath,
            text: parsed.text || "",
            confidence: parsed.confidence || 0,
            error: parsed.error
          };
          console.log(`[OCR] Final result:`, result);
          if (!result.error && result.text) {
            saveCachedResult(imagePath, result);
            console.log(`[OCR] Cached successful result`);
          }
          resolve(result);
        } catch (parseError) {
          console.log(`[OCR] Failed to parse JSON output: ${parseError}`);
          console.log(`[OCR] Raw output was: "${stdout}"`);
          const result = {
            filePath: imagePath,
            text: "",
            confidence: 0,
            error: `Failed to parse OCR result: ${parseError}`
          };
          resolve(result);
        }
      });
      child.on("error", (error) => {
        console.log(`[OCR] Swift process error: ${error.message}`);
        console.log(`[OCR] Error details:`, error);
        clearTimeout(timeout);
        try {
          import_node_fs3.default.unlinkSync(scriptPath);
          console.log(`[OCR] Cleaned up script after error`);
        } catch (cleanupError) {
          console.log(`[OCR] Failed to cleanup after error: ${cleanupError}`);
        }
        resolve({
          filePath: imagePath,
          text: "",
          confidence: 0,
          error: `Failed to execute Swift: ${error.message}`
        });
      });
    } catch (error) {
      console.log(`[OCR] Failed to create Swift script: ${error}`);
      resolve({
        filePath: imagePath,
        text: "",
        confidence: 0,
        error: `Failed to create Swift script: ${error}`
      });
    }
  });
}
async function findImagesWithText(searchText, searchPaths, ctx) {
  var _a;
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"];
  console.log(`[OCR] findImagesWithText called with searchText: "${searchText}"`);
  console.log(`[OCR] searchPaths:`, searchPaths);
  const hasUploadedImage = searchPaths && searchPaths.length > 0 && searchPaths.some((p) => p.includes("uploaded-image-"));
  console.log(`[OCR] hasUploadedImage:`, hasUploadedImage);
  const results = [];
  if (searchPaths && searchPaths.length > 0 && searchPaths.some((p) => p.includes("uploaded-image-"))) {
    console.log(`[OCR] Processing specific uploaded image files:`, searchPaths);
    for (const imagePath of searchPaths) {
      if (!import_node_fs3.default.existsSync(imagePath)) {
        console.log(`[OCR] Uploaded image not found: ${imagePath}`);
        continue;
      }
      const stats = import_node_fs3.default.statSync(imagePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      if (stats.size === 0) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_skip",
            taskId: ctx.task.id,
            message: `Skipped uploaded image: File is empty (0 bytes)`,
            filePath: imagePath
          });
        }
        continue;
      }
      if (fileSizeInMB > 20) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_skip",
            taskId: ctx.task.id,
            message: `Skipped uploaded image: File too large (${fileSizeInMB.toFixed(1)}MB, limit 20MB)`,
            filePath: imagePath
          });
        }
        continue;
      }
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_file_start",
          taskId: ctx.task.id,
          message: `Processing uploaded image: ${import_node_path3.default.basename(imagePath)} (${fileSizeInMB.toFixed(1)}MB)`,
          filePath: imagePath
        });
      }
      try {
        const ocrResult = OCR_BACKEND === "vision" ? await extractTextFromImage(imagePath, ctx) : await extractTextWithTesseract(imagePath, ctx);
        if (ocrResult.error || !ocrResult.text) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: "ocr_file_skip",
              taskId: ctx.task.id,
              message: `Skipped uploaded image: ${ocrResult.error || "No text found"}`,
              filePath: imagePath
            });
          }
          continue;
        }
        const extractedTextLower = ocrResult.text.toLowerCase();
        let matchScore;
        if (searchText === "*") {
          matchScore = ocrResult.text.trim() ? ocrResult.confidence : 0;
        } else {
          matchScore = calculateMatchScore(searchText.toLowerCase(), extractedTextLower);
        }
        if (ctx) {
          const preview = ocrResult.text.slice(0, 100) + (ocrResult.text.length > 100 ? "..." : "");
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_complete",
            taskId: ctx.task.id,
            message: `Uploaded image processed: ${Math.round(ocrResult.confidence * 100)}% confidence`,
            filePath: imagePath,
            extractedText: preview,
            confidence: ocrResult.confidence,
            matchScore
          });
        }
        results.push({
          path: imagePath,
          type: "file",
          extractedText: ocrResult.text,
          confidence: ocrResult.confidence,
          matchScore
        });
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_match",
            taskId: ctx.task.id,
            message: `\u2713 Text extracted from uploaded image`,
            filePath: imagePath
          });
        }
      } catch (error) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_error",
            taskId: ctx.task.id,
            message: `Error processing uploaded image: ${error}`,
            filePath: imagePath
          });
        }
        console.warn(`OCR failed for uploaded image ${imagePath}:`, error);
      }
    }
    return {
      query: searchText,
      results
    };
  }
  const defaultPaths = [
    import_node_path3.default.join(import_node_os3.default.homedir(), "Desktop"),
    import_node_path3.default.join(import_node_os3.default.homedir(), "Documents"),
    import_node_path3.default.join(import_node_os3.default.homedir(), "Downloads"),
    import_node_path3.default.join(import_node_os3.default.homedir(), "Pictures")
  ];
  const pathsToSearch = searchPaths || defaultPaths;
  const imageFiles = [];
  let totalFiles = 0;
  let imageFilesFound = 0;
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: "ocr_scan_start",
      taskId: ctx.task.id,
      message: `Scanning directories for images: ${pathsToSearch.join(", ")}`
    });
  }
  for (const searchPath of pathsToSearch) {
    try {
      if (!import_node_fs3.default.existsSync(searchPath)) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_scan_skip",
            taskId: ctx.task.id,
            message: `Directory not found: ${searchPath}`
          });
        }
        continue;
      }
      const items = import_node_fs3.default.readdirSync(searchPath, { withFileTypes: true });
      totalFiles += items.length;
      for (const item of items) {
        if (item.isFile()) {
          const fullPath = import_node_path3.default.join(searchPath, item.name);
          const ext = import_node_path3.default.extname(item.name).toLowerCase();
          if (imageExtensions.includes(ext)) {
            imageFiles.push(fullPath);
            imageFilesFound++;
          }
        }
      }
      if (ctx) {
        const dirImageCount = items.filter(
          (item) => item.isFile() && imageExtensions.includes(import_node_path3.default.extname(item.name).toLowerCase())
        ).length;
        db.addRunEvent(ctx.runId, {
          type: "ocr_scan_directory",
          taskId: ctx.task.id,
          message: `${import_node_path3.default.basename(searchPath)}: ${dirImageCount}/${items.length} images`
        });
      }
    } catch (error) {
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_scan_error",
          taskId: ctx.task.id,
          message: `Failed to scan ${searchPath}: ${error}`
        });
      }
      console.warn(`Failed to search path ${searchPath}:`, error);
    }
  }
  if (ctx) {
    db.addRunEvent(ctx.runId, {
      type: "ocr_scan_complete",
      taskId: ctx.task.id,
      message: `Scan complete: ${imageFilesFound} images found out of ${totalFiles} total files`
    });
  }
  const cpuCores = Math.max(2, ((_a = import_node_os3.default.cpus()) == null ? void 0 : _a.length) || 4);
  const batchSize = Math.min(4, Math.max(1, Math.floor(cpuCores / 2)));
  const minConfidenceGeneral = 0.85;
  const minConfidenceSearch = 0.85;
  const minRelevanceSearch = 0.85;
  const requiredConfidence = searchText === "*" ? minConfidenceGeneral : minConfidenceSearch;
  const searchTextLower = searchText.toLowerCase();
  let processedCount = 0;
  let timeoutCount = 0;
  if (ctx && imageFiles.length > 0) {
    db.addRunEvent(ctx.runId, {
      type: "ocr_process_start",
      taskId: ctx.task.id,
      message: `Starting OCR processing of ${imageFiles.length} images in batches of ${batchSize}`
    });
  }
  let earlyStop = false;
  for (let i = 0; i < imageFiles.length && !earlyStop; i += batchSize) {
    const batch = imageFiles.slice(i, i + batchSize);
    if (ctx) {
      db.addRunEvent(ctx.runId, {
        type: "ocr_batch_start",
        taskId: ctx.task.id,
        message: `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imageFiles.length / batchSize)} (${batch.length} files)`
      });
    }
    const batchPromises = batch.map(async (imagePath) => {
      const fileName = import_node_path3.default.basename(imagePath);
      if (!isFileSizeReasonable(imagePath)) {
        const stats = import_node_fs3.default.statSync(imagePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(1);
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_skip",
            taskId: ctx.task.id,
            message: `Skipped ${fileName}: File too large (${fileSizeInMB}MB, limit 10MB)`,
            filePath: imagePath
          });
        }
        return null;
      }
      if (ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_file_start",
          taskId: ctx.task.id,
          message: `Processing: ${fileName}`,
          filePath: imagePath
        });
      }
      try {
        const ocrResult = OCR_BACKEND === "vision" ? await extractTextFromImage(imagePath) : await extractTextWithTesseract(imagePath, ctx);
        processedCount++;
        if (ocrResult.error || !ocrResult.text) {
          if (ocrResult.error && ocrResult.error.includes("timeout")) {
            timeoutCount++;
          }
          if (ctx) {
            const eventType = ocrResult.error && ocrResult.error.includes("timeout") ? "ocr_file_timeout" : "ocr_file_skip";
            db.addRunEvent(ctx.runId, {
              type: eventType,
              taskId: ctx.task.id,
              message: `${ocrResult.error && ocrResult.error.includes("timeout") ? "\u23F0 Timeout" : "Skipped"} ${fileName}: ${ocrResult.error || "No text found"}`,
              filePath: imagePath
            });
          }
          return null;
        }
        const extractedTextLower = ocrResult.text.toLowerCase();
        let matchScore;
        if (searchText === "*") {
          matchScore = ocrResult.text.trim() ? ocrResult.confidence : 0;
        } else {
          matchScore = calculateMatchScore(searchTextLower, extractedTextLower);
        }
        const strongRelevance = searchText !== "*" && matchScore >= 0.95;
        if (searchText !== "*" && matchScore < minRelevanceSearch) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: "ocr_file_skip",
              taskId: ctx.task.id,
              message: `${fileName}: Skipped due to low relevance (${Math.round(matchScore * 100)}% < ${Math.round(minRelevanceSearch * 100)}%)`,
              filePath: imagePath
            });
          }
          return null;
        }
        if (ocrResult.confidence < requiredConfidence && !strongRelevance) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: "ocr_file_skip",
              taskId: ctx.task.id,
              message: `${fileName}: Skipped due to low confidence (${Math.round(ocrResult.confidence * 100)}% < ${Math.round(requiredConfidence * 100)}%)`,
              filePath: imagePath
            });
          }
          return null;
        }
        if (ctx) {
          const preview = ocrResult.text.slice(0, 100) + (ocrResult.text.length > 100 ? "..." : "");
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_complete",
            taskId: ctx.task.id,
            message: `${fileName}: ${Math.round(ocrResult.confidence * 100)}% confidence, ${Math.round(matchScore * 100)}% match`,
            filePath: imagePath,
            extractedText: preview,
            confidence: ocrResult.confidence,
            matchScore
          });
        }
        const threshold = searchText === "*" ? 0 : minRelevanceSearch;
        if (matchScore >= threshold) {
          if (ctx) {
            db.addRunEvent(ctx.runId, {
              type: "ocr_file_match",
              taskId: ctx.task.id,
              message: `\u2713 Match found in ${fileName} (${Math.round(ocrResult.confidence * 100)}% confidence, ${Math.round(matchScore * 100)}% relevance)`,
              filePath: imagePath
            });
          }
          return {
            path: imagePath,
            type: "file",
            extractedText: ocrResult.text,
            confidence: ocrResult.confidence,
            matchScore
          };
        }
        return null;
      } catch (error) {
        if (ctx) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_file_error",
            taskId: ctx.task.id,
            message: `Error processing ${fileName}: ${error}`,
            filePath: imagePath
          });
        }
        console.warn(`OCR failed for ${imagePath}:`, error);
        return null;
      }
    });
    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }
    if (ctx) {
      const batchMatches = batchResults.filter((r) => r !== null).length;
      const batchTimeouts = batch.length - batchResults.length;
      db.addRunEvent(ctx.runId, {
        type: "ocr_batch_complete",
        taskId: ctx.task.id,
        message: `Batch complete: ${batchMatches} matches found in ${batch.length} files${batchTimeouts > 0 ? ` (${batchTimeouts} timeouts)` : ""}`
      });
    }
    if (searchText !== "*") {
      const killer = batchResults.find((r) => r && r.matchScore >= 0.99);
      if (killer && ctx) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_early_stop",
          taskId: ctx.task.id,
          message: `Early stop on strong hit (${Math.round(killer.matchScore * 100)}% relevance${typeof killer.confidence === "number" ? `, ${Math.round(killer.confidence * 100)}% confidence` : ""})`,
          filePath: killer.path
        });
        earlyStop = true;
      }
    }
  }
  results.sort((a, b) => b.matchScore - a.matchScore);
  if (ctx && timeoutCount > 0) {
    db.addRunEvent(ctx.runId, {
      type: "ocr_timeout_summary",
      taskId: ctx.task.id,
      message: `\u26A0\uFE0F ${timeoutCount} files timed out during OCR processing (consider reducing image sizes or complexity)`
    });
  }
  return {
    query: searchText,
    results
  };
}
function calculateMatchScore(searchText, extractedText) {
  if (!searchText || !extractedText) return 0;
  if (extractedText.includes(searchText)) {
    return 1;
  }
  const searchWords = searchText.split(/\s+/).filter((w) => w.length > 2);
  const extractedWords = extractedText.split(/\s+/).map((w) => w.toLowerCase());
  if (searchWords.length === 0) return 0;
  let matchedWords = 0;
  for (const word of searchWords) {
    if (extractedWords.some((ew) => ew.includes(word.toLowerCase()))) {
      matchedWords++;
    }
  }
  return matchedWords / searchWords.length;
}
async function spawnOCRAgent(ctx) {
  var _a;
  try {
    const swiftAvailable = await testSwiftAvailability();
    if (!swiftAvailable) {
      db.addRunEvent(ctx.runId, {
        type: "error",
        taskId: ctx.task.id,
        message: "Swift is not available or not working. Falling back to Tesseract."
      });
      OCR_BACKEND = "tesseract";
    }
    if (OCR_BACKEND === "vision") {
      const visionAvailable = await testVisionFramework(ctx);
      if (!visionAvailable) {
        db.addRunEvent(ctx.runId, {
          type: "error",
          taskId: ctx.task.id,
          message: "Vision framework is not working properly. Falling back to Tesseract."
        });
        OCR_BACKEND = "tesseract";
      } else {
        OCR_BACKEND = "vision";
      }
    }
    const parsed = JSON.parse(ctx.task.description);
    if ((parsed == null ? void 0 : parsed.op) === "ocr_search" && typeof parsed.text === "string") {
      const searchText = parsed.text;
      const searchPaths = parsed.paths || void 0;
      const originalPrompt = parsed.originalPrompt || searchText;
      const imageKeywords = ["screenshot", "image", "picture", "photo", "pic", "snap", "capture"];
      const mentionsImages = imageKeywords.some(
        (keyword) => originalPrompt.toLowerCase().includes(keyword)
      );
      if (mentionsImages) {
        db.addRunEvent(ctx.runId, {
          type: "ocr_smart_filter",
          taskId: ctx.task.id,
          message: `Smart filtering enabled: User mentioned images/screenshots, focusing search on image files only`
        });
      }
      const isGeneralOcr = searchText === "*";
      const displayText = isGeneralOcr ? "all text" : `"${searchText}"`;
      db.addRunEvent(ctx.runId, {
        type: "ocr_start",
        taskId: ctx.task.id,
        searchText,
        smartFilter: mentionsImages,
        message: `Starting OCR ${isGeneralOcr ? "text extraction" : "search"} for: ${displayText}${mentionsImages ? " (image files only)" : ""}`
      });
      const result = await findImagesWithText(searchText, searchPaths, ctx);
      db.addRunEvent(ctx.runId, {
        type: "ocr_complete",
        taskId: ctx.task.id,
        query: result.query,
        results: result.results.map((r) => ({
          path: r.path,
          extractedText: r.extractedText.slice(0, 200),
          // Truncate for event
          confidence: r.confidence,
          matchScore: r.matchScore
        })),
        message: `OCR search complete: ${result.results.length} matching images found`
      });
      const isUploadedImage = searchPaths && searchPaths.length > 0 && searchPaths.some((p) => p.includes("uploaded-image-"));
      if (isUploadedImage) {
        const ocrResult = result.results[0];
        const hasText = !!((_a = ocrResult == null ? void 0 : ocrResult.extractedText) == null ? void 0 : _a.trim());
        const responseText = hasText ? `I can see the following text in your image:

"${ocrResult.extractedText}"

(Confidence: ${Math.round(ocrResult.confidence * 100)}%)` : "I couldn't detect any readable text in this image. The image might be too blurry, the text might be too small, or it might not contain text.";
        db.addRunEvent(ctx.runId, {
          type: "ocr_response",
          taskId: ctx.task.id,
          message: responseText,
          extractedText: (ocrResult == null ? void 0 : ocrResult.extractedText) || "",
          confidence: (ocrResult == null ? void 0 : ocrResult.confidence) ?? 0
        });
      } else {
        db.addRunEvent(ctx.runId, {
          type: "file_located",
          taskId: ctx.task.id,
          query: searchText,
          results: result.results.map((r) => r.path),
          searchType: "content",
          ocrResults: result.results
          // Additional OCR data
        });
      }
      return result;
    }
    throw new Error("Invalid OCR operation format");
  } catch (error) {
    db.addRunEvent(ctx.runId, {
      type: "error",
      taskId: ctx.task.id,
      message: `OCR operation failed: ${error}`
    });
    throw error;
  }
}
var import_node_child_process, import_node_path3, import_node_fs3, import_node_os3, import_node_crypto, import_tesseract, OCR_BACKEND, OCR_CACHE_DIR;
var init_ocr = __esm({
  "src/agent/workers/ocr.ts"() {
    init_cjs_shims();
    import_node_child_process = require("child_process");
    import_node_path3 = __toESM(require("path"), 1);
    import_node_fs3 = __toESM(require("fs"), 1);
    import_node_os3 = __toESM(require("os"), 1);
    import_node_crypto = __toESM(require("crypto"), 1);
    init_db();
    import_tesseract = __toESM(require("tesseract.js"), 1);
    OCR_BACKEND = "vision";
    OCR_CACHE_DIR = import_node_path3.default.join(import_node_os3.default.homedir(), ".local-agent", "ocr-cache");
  }
});

// src/agent/workers/fileops.ts
var fileops_exports = {};
__export(fileops_exports, {
  spawnFileOpsAgent: () => spawnFileOpsAgent
});
async function spawnFileOpsAgent(ctx) {
  var _a, _b, _c;
  try {
    const parsed = JSON.parse(ctx.task.description);
    if ((parsed == null ? void 0 : parsed.op) === "open" && typeof parsed.name === "string") {
      const name = String(parsed.name).toLowerCase();
      const scope = (parsed.scope || "any").toLowerCase();
      const action = parsed.action === "reveal" ? "reveal" : "open";
      const home2 = import_node_os4.default.homedir();
      const scopes = {
        desktop: import_node_path4.default.join(home2, process.platform === "win32" ? "Desktop" : "Desktop"),
        documents: import_node_path4.default.join(home2, process.platform === "win32" ? "Documents" : "Documents"),
        downloads: import_node_path4.default.join(home2, process.platform === "win32" ? "Downloads" : "Downloads"),
        pictures: import_node_path4.default.join(home2, process.platform === "win32" ? "Pictures" : "Pictures")
      };
      const roots = scope === "any" ? Object.values(scopes) : [scopes[scope]].filter(Boolean);
      for (const root of roots) {
        try {
          const entries = import_node_fs4.default.readdirSync(root);
          let match = entries.find((e) => e.toLowerCase() === name);
          if (!match) match = entries.find((e) => e.toLowerCase() === `${name} images`);
          if (!match) match = entries.find((e) => e.toLowerCase().includes(name));
          if (match) {
            const target = import_node_path4.default.join(root, match);
            if (action === "open") {
              const { shell: shell2 } = await import("electron");
              await shell2.openPath(target);
            } else {
              const { shell: shell2 } = await import("electron");
              shell2.showItemInFolder(target);
            }
            db.addRunEvent(ctx.runId, { type: "file_open", taskId: ctx.task.id, path: target, action });
            return { path: target, action };
          }
        } catch {
        }
      }
      throw new Error(`Could not find ${parsed.name} in ${scope}`);
    }
    if ((parsed == null ? void 0 : parsed.op) === "ocr_search" && typeof parsed.text === "string") {
      console.log("Direct OCR search operation detected:", parsed);
      return await spawnOCRAgent(ctx);
    }
    if ((parsed == null ? void 0 : parsed.op) === "locate" && typeof parsed.name === "string") {
      let name = String(parsed.name);
      const q = name.match(/["']([^"']+)["']/);
      if (q && q[1]) name = q[1];
      const scope = (parsed.scope || "any").toLowerCase();
      const contentSearch = parsed.contentSearch || false;
      const originalPrompt = parsed.originalPrompt || name;
      const listType = parsed.listType;
      const home2 = import_node_os4.default.homedir();
      const candidates = [];
      const scopes = {
        desktop: import_node_path4.default.join(home2, "Desktop"),
        documents: import_node_path4.default.join(home2, "Documents"),
        downloads: import_node_path4.default.join(home2, "Downloads"),
        pictures: import_node_path4.default.join(home2, "Pictures")
      };
      if (contentSearch) {
        try {
          const ocrResult = await spawnOCRAgent({
            ...ctx,
            task: {
              ...ctx.task,
              description: JSON.stringify({
                op: "ocr_search",
                text: name,
                paths: scope === "any" ? Object.values(scopes) : [scopes[scope]].filter(Boolean),
                originalPrompt
                // Pass original prompt for smart filtering
              })
            }
          });
          if (ocrResult && ocrResult.results && ocrResult.results.length > 0) {
            const ocrPaths = ocrResult.results.map((r) => r.path);
            db.addRunEvent(ctx.runId, {
              type: "file_located",
              taskId: ctx.task.id,
              query: name,
              results: ocrPaths,
              searchType: "content",
              ocrResults: ocrResult.results
            });
            return { query: name, results: ocrPaths, searchType: "content" };
          }
        } catch (ocrError) {
          db.addRunEvent(ctx.runId, {
            type: "ocr_fallback",
            taskId: ctx.task.id,
            message: `OCR search failed, falling back to filename search: ${ocrError}`
          });
        }
      }
      try {
        const { execSync } = await import("child_process");
        let out = "";
        if (process.platform === "darwin") {
          if (!listType) {
            const cmd = `mdfind -name ${JSON.stringify(name)}`;
            out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          }
        } else if (process.platform === "win32") {
          if (!listType) {
            const roots = [
              scopes.desktop,
              scopes.documents,
              scopes.downloads,
              scopes.pictures
            ].filter(Boolean).map((r) => r.replace(/`/g, "``").replace(/"/g, '``"'));
            const ps = `Get-ChildItem -LiteralPath ${roots.map((r) => `"${r}"`).join(",")} -Recurse -Depth 3 -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*${name.replace(/"/g, '""')}*" } | Select-Object -ExpandProperty FullName`;
            out = execSync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${ps}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          }
        }
        if (out) {
          const lines = out.split("\n").map((s) => s.trim()).filter(Boolean);
          for (const p of lines) {
            if (scope !== "any") {
              const base = scopes[scope];
              if (base && !p.startsWith(base)) continue;
            }
            candidates.push(p);
            if (candidates.length >= 50) break;
          }
        }
      } catch {
      }
      if (candidates.length === 0) {
        const dirs = scope === "any" ? Object.values(scopes) : [scopes[scope]].filter(Boolean);
        for (const d of dirs) {
          try {
            if ((_a = ctx.signal) == null ? void 0 : _a.aborted) throw new Error("Cancelled");
            const items = import_node_fs4.default.readdirSync(d, { withFileTypes: true });
            for (const it of items) {
              const full = import_node_path4.default.join(d, it.name);
              if (listType === "folders") {
                if (it.isDirectory()) candidates.push(full);
              } else if (listType === "files") {
                if (it.isFile()) candidates.push(full);
              } else if (it.name.toLowerCase().includes(name.toLowerCase())) {
                candidates.push(full);
              }
            }
          } catch {
          }
        }
      }
      if ((_b = ctx.signal) == null ? void 0 : _b.aborted) throw new Error("Cancelled");
      db.addRunEvent(ctx.runId, {
        type: "file_located",
        taskId: ctx.task.id,
        query: listType ? `${listType} on ${scope}` : name,
        results: candidates,
        searchType: listType ? "listing" : "filename"
      });
      return { query: listType ? `${listType} on ${scope}` : name, results: candidates, searchType: listType ? "listing" : "filename" };
    }
    if ((parsed == null ? void 0 : parsed.op) === "mkdir" && typeof parsed.name === "string") {
      const home2 = import_node_os4.default.homedir();
      const scopes = {
        desktop: import_node_path4.default.join(home2, "Desktop"),
        documents: import_node_path4.default.join(home2, "Documents"),
        downloads: import_node_path4.default.join(home2, "Downloads"),
        pictures: import_node_path4.default.join(home2, "Pictures")
      };
      const scope = (parsed.scope || "documents").toLowerCase();
      const base = scopes[scope] || import_node_path4.default.join(home2, "Documents");
      const target = import_node_path4.default.isAbsolute(parsed.name) ? parsed.name : import_node_path4.default.join(base, parsed.name);
      try {
        import_node_fs4.default.mkdirSync(target, { recursive: true });
      } catch {
      }
      db.addRunEvent(ctx.runId, { type: "file_created", taskId: ctx.task.id, path: target });
      return { path: target, created: true };
    }
    if ((parsed == null ? void 0 : parsed.op) === "move" && typeof parsed.src === "string" && typeof parsed.dest === "string") {
      const expand = (p) => p.startsWith("~") ? import_node_path4.default.join(import_node_os4.default.homedir(), p.slice(1)) : p;
      const src = expand(parsed.src);
      const destRaw = expand(parsed.dest);
      const dest = import_node_path4.default.isAbsolute(destRaw) ? destRaw : import_node_path4.default.join(import_node_path4.default.dirname(src), destRaw);
      import_node_fs4.default.renameSync(src, dest);
      db.addRunEvent(ctx.runId, { type: "file_moved", taskId: ctx.task.id, src, dest });
      return { src, dest };
    }
    if ((parsed == null ? void 0 : parsed.op) === "copy" && typeof parsed.src === "string" && typeof parsed.dest === "string") {
      const expand = (p) => p.startsWith("~") ? import_node_path4.default.join(import_node_os4.default.homedir(), p.slice(1)) : p;
      const src = expand(parsed.src);
      const destRaw = expand(parsed.dest);
      const dest = import_node_path4.default.isAbsolute(destRaw) ? destRaw : import_node_path4.default.join(import_node_path4.default.dirname(src), destRaw);
      const stat = import_node_fs4.default.statSync(src);
      if (stat.isDirectory()) {
        import_node_fs4.default.mkdirSync(dest, { recursive: true });
        const entries = import_node_fs4.default.readdirSync(src, { withFileTypes: true });
        for (const it of entries) {
          if (it.isFile()) {
            import_node_fs4.default.copyFileSync(import_node_path4.default.join(src, it.name), import_node_path4.default.join(dest, it.name));
          }
        }
      } else {
        import_node_fs4.default.mkdirSync(import_node_path4.default.dirname(dest), { recursive: true });
        import_node_fs4.default.copyFileSync(src, dest);
      }
      db.addRunEvent(ctx.runId, { type: "file_copied", taskId: ctx.task.id, src, dest });
      return { src, dest };
    }
    if ((parsed == null ? void 0 : parsed.op) === "rename" && typeof parsed.src === "string" && typeof parsed.dest === "string") {
      let expandHome = function(p) {
        return p.startsWith("~") ? import_node_path4.default.join(import_node_os4.default.homedir(), p.slice(1)) : p;
      }, resolveFromPhrase = function(phrase) {
        const text = phrase.trim().toLowerCase();
        const maybe = expandHome(phrase);
        if (import_node_path4.default.isAbsolute(maybe) && import_node_fs4.default.existsSync(maybe)) return maybe;
        const desktopDir = import_node_path4.default.join(import_node_os4.default.homedir(), "Desktop");
        if (text.includes("desktop")) {
          let name = phrase;
          const m = phrase.match(/(?:named|called)\s+['\"]?(.+?)['\"]?(?=\s+(?:on|to|$)|$)/i);
          if (m == null ? void 0 : m[1]) name = m[1];
          name = name.replace(/on my desktop|on desktop/gi, "").trim();
          name = name.replace(/^['\"]|['\"]$/g, "");
          const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
          const targetNorm = normalize(name);
          const entries = import_node_fs4.default.existsSync(desktopDir) ? import_node_fs4.default.readdirSync(desktopDir) : [];
          let match = entries.find((e) => normalize(e) === targetNorm);
          if (match) return import_node_path4.default.join(desktopDir, match);
          const soft = entries.filter((e) => !/^untitled$/i.test(normalize(e))).find((e) => normalize(e).includes(targetNorm));
          if (soft) return import_node_path4.default.join(desktopDir, soft);
        }
        return null;
      };
      let srcPath = expandHome(parsed.src);
      if (!import_node_fs4.default.existsSync(srcPath)) {
        const guess = resolveFromPhrase(parsed.src);
        if (guess) srcPath = guess;
      }
      if (!import_node_fs4.default.existsSync(srcPath)) {
        throw new Error(`Source not found: ${parsed.src}`);
      }
      let destPath = expandHome(parsed.dest);
      if (!import_node_path4.default.isAbsolute(destPath)) {
        destPath = import_node_path4.default.join(import_node_path4.default.dirname(srcPath), parsed.dest);
      }
      import_node_fs4.default.renameSync(srcPath, destPath);
      db.addRunEvent(ctx.runId, { type: "file_renamed", taskId: ctx.task.id, src: srcPath, dest: destPath });
      return { src: srcPath, dest: destPath };
    }
  } catch {
  }
  const home = import_node_os4.default.homedir();
  const outDir = import_node_path4.default.join(home, "Documents");
  const outPath = import_node_path4.default.join(outDir, `agent-summary-${Date.now()}.md`);
  const researchResults = db.getTaskResultsByRole(ctx.runId, "research");
  const lastResearch = researchResults[researchResults.length - 1] || {};
  const articles = lastResearch.articles ?? [];
  let extracts = "";
  for (const a of articles.slice(0, 3)) {
    try {
      const t = import_node_fs4.default.readFileSync(a.path, "utf8");
      extracts += `## ${a.title ?? import_node_path4.default.basename(a.path)}
${a.url ? a.url + "\n" : ""}
${t.slice(0, 1200)}

---

`;
    } catch {
    }
  }
  const reviews = db.getTaskResultsByRole(ctx.runId, "reviewer");
  const reviewNote = ((_c = reviews[reviews.length - 1]) == null ? void 0 : _c.summary) ?? "";
  const content = `# Summary

Task: ${ctx.task.description}

Key Takeaways (draft):

${reviewNote}

Extracts (truncated):

${extracts}
Generated at ${(/* @__PURE__ */ new Date()).toISOString()}
`;
  import_node_fs4.default.writeFileSync(outPath, content, "utf8");
  db.addRunEvent(ctx.runId, { type: "file_write", taskId: ctx.task.id, path: outPath });
  return { path: outPath };
}
var import_node_fs4, import_node_path4, import_node_os4;
var init_fileops = __esm({
  "src/agent/workers/fileops.ts"() {
    init_cjs_shims();
    import_node_fs4 = __toESM(require("fs"), 1);
    import_node_path4 = __toESM(require("path"), 1);
    import_node_os4 = __toESM(require("os"), 1);
    init_db();
    init_ocr();
  }
});

// src/agent/confirm.ts
function keyFor(runId, taskId) {
  return `${runId}:${taskId}`;
}
function requestConfirmation(runId, taskId) {
  const k = keyFor(runId, taskId);
  return new Promise((resolve) => {
    pending.set(k, resolve);
    setTimeout(() => {
      var _a;
      if (pending.has(k)) {
        (_a = pending.get(k)) == null ? void 0 : _a(false);
        pending.delete(k);
      }
    }, 9e4);
  });
}
function resolveConfirmation(runId, taskId, confirmed) {
  const k = keyFor(runId, taskId);
  const fn = pending.get(k);
  if (fn) {
    fn(confirmed);
    pending.delete(k);
  }
}
var pending;
var init_confirm = __esm({
  "src/agent/confirm.ts"() {
    init_cjs_shims();
    pending = /* @__PURE__ */ new Map();
  }
});

// src/agent/workers/shell.ts
var shell_exports = {};
__export(shell_exports, {
  spawnShellAgent: () => spawnShellAgent
});
function parseCommandFromDescription(desc) {
  try {
    const j = JSON.parse(desc);
    if (j && typeof j.cmd === "string") return { cmd: j.cmd, meta: j.meta };
  } catch {
  }
  const m = desc.match(/^(?:shell:|run:|execute:)\s*(.+)$/i);
  if (m && m[1]) return { cmd: m[1].trim() };
  return null;
}
function isWhitelisted(cmd) {
  const first = cmd.trim().split(/\s+/)[0];
  const whitelist = /* @__PURE__ */ new Set([
    // cross-platform basics
    "git",
    "ls",
    "cat",
    "echo",
    "pwd",
    // macOS helpers
    "open",
    "osascript",
    "killall",
    // Windows helpers (PowerShell and cmd)
    "Start-Process",
    "Get-Process",
    "Stop-Process",
    "taskkill",
    "cmd",
    "powershell",
    "Add-Type",
    // Windows PowerShell equivalents
    "Get-ChildItem",
    "Get-Content",
    "Set-Location",
    "Get-Location",
    "dir",
    "type",
    // cmd.exe equivalents  
    "cd",
    "md",
    "rd",
    "copy",
    "move",
    "del"
  ]);
  return whitelist.has(first);
}
async function spawnShellAgent(ctx) {
  const parsed = parseCommandFromDescription(ctx.task.description);
  if (!parsed) {
    throw new Error("No shell command provided");
  }
  let cmd = parsed.cmd;
  if (process.platform === "win32") {
    const openMatch = cmd.match(/^open\s+-a\s+"([^"]+)"/i);
    if (openMatch) {
      const app2 = openMatch[1].replace('"', '""');
      cmd = `Start-Process -FilePath "${app2}"`;
    }
    const osaQuit = cmd.match(/^osascript\b.+?tell application \"([^\"]+)\" to quit/i);
    if (osaQuit) {
      const app2 = osaQuit[1].replace('"', '""');
      cmd = `Get-Process -Name "${app2}" -ErrorAction SilentlyContinue | Stop-Process -Force`;
    }
    if (cmd.match(/^ls\b/)) {
      if (cmd.includes("Desktop") || cmd.includes("desktop")) {
        cmd = cmd.replace(/^ls\b.*/, 'Get-ChildItem "$env:USERPROFILE\\Desktop" | Select-Object Name, Mode, LastWriteTime, Length | Format-Table -AutoSize');
      } else {
        cmd = cmd.replace(/^ls\b/, "Get-ChildItem");
        cmd = cmd.replace(/\s+-la?\b/, " | Format-Table Name, Mode, LastWriteTime, Length -AutoSize");
        cmd = cmd.replace(/\s+-l\b/, " | Format-Table Name, Mode, LastWriteTime, Length -AutoSize");
        cmd = cmd.replace(/\s+-a\b/, " -Force");
      }
    }
    if (cmd.match(/^pwd\b/)) {
      cmd = cmd.replace(/^pwd\b/, "Get-Location");
    }
    if (cmd.match(/^cat\b/)) {
      cmd = cmd.replace(/^cat\b/, "Get-Content");
    }
    if (process.env.FORCE_CMD === "1") {
      cmd = cmd.replace(/\$HOME\/Desktop/g, "%USERPROFILE%\\Desktop");
      cmd = cmd.replace(/~\/Desktop/g, "%USERPROFILE%\\Desktop");
      cmd = cmd.replace(/^Get-ChildItem\b.*/, 'dir "%USERPROFILE%\\Desktop"');
      cmd = cmd.replace(/^Get-Location\b/, "cd");
      cmd = cmd.replace(/^Get-Content\b/, "type");
    } else {
      cmd = cmd.replace(/\$HOME\/Desktop/g, "$env:USERPROFILE\\Desktop");
      cmd = cmd.replace(/~\/Desktop/g, "$env:USERPROFILE\\Desktop");
    }
  }
  const meta = parsed.meta;
  const whitelisted = isWhitelisted(cmd);
  if (!whitelisted && !ctx.automation) {
    db.addRunEvent(ctx.runId, { type: "confirm_dangerous", runId: ctx.runId, taskId: ctx.task.id, op: "shell", path: cmd });
    const ok = await requestConfirmation(ctx.runId, ctx.task.id);
    if (!ok) throw new Error("User denied shell command");
  }
  db.addRunEvent(ctx.runId, { type: "shell_start", taskId: ctx.task.id, cmd });
  if (meta && meta.kind === "slack_dm") {
    db.addRunEvent(ctx.runId, { type: "dm_hint", taskId: ctx.task.id, to: meta.to, message: meta.message });
  }
  const shellBin = process.platform === "win32" ? process.env.FORCE_CMD === "1" ? "cmd.exe" : "powershell.exe" : process.env.SHELL || "/bin/zsh";
  const home = import_node_os5.default.homedir();
  if (process.platform === "win32") {
    console.log(`[Shell] Windows command: ${cmd}`);
    console.log(`[Shell] Shell binary: ${shellBin}`);
    console.log(`[Shell] Home directory: ${home}`);
  }
  return await new Promise((resolve, reject) => {
    var _a, _b;
    const args = process.platform === "win32" ? shellBin === "cmd.exe" ? ["/c", cmd] : ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd] : ["-lc", cmd];
    const child = (0, import_node_child_process2.spawn)(shellBin, args, { cwd: home, env: process.env });
    let out = "";
    let err = "";
    let aborted = false;
    const onAbort = () => {
      if (aborted) return;
      aborted = true;
      try {
        db.addRunEvent(ctx.runId, { type: "shell_cancelled", taskId: ctx.task.id, cmd });
      } catch {
      }
      try {
        child.kill("SIGTERM");
      } catch {
      }
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      }, 500);
    };
    if ((_a = ctx.signal) == null ? void 0 : _a.aborted) onAbort();
    (_b = ctx.signal) == null ? void 0 : _b.addEventListener("abort", onAbort);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
      db.addRunEvent(ctx.runId, { type: "shell_output", taskId: ctx.task.id, stream: "stdout", chunk: chunk.slice(0, 4e3) });
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
      db.addRunEvent(ctx.runId, { type: "shell_output", taskId: ctx.task.id, stream: "stderr", chunk: chunk.slice(0, 4e3) });
    });
    child.on("error", (e) => {
      db.addRunEvent(ctx.runId, { type: "error", taskId: ctx.task.id, message: String((e == null ? void 0 : e.message) ?? e) });
      reject(e);
    });
    child.on("close", (code) => {
      const exitCode = typeof code === "number" ? code : -1;
      db.addRunEvent(ctx.runId, { type: "shell_end", taskId: ctx.task.id, exitCode });
      if (!aborted && exitCode === 0 && meta && meta.kind === "slack_dm") {
        db.addRunEvent(ctx.runId, { type: "dm_sent", taskId: ctx.task.id, to: meta.to, message: meta.message });
      }
      if (aborted) {
        reject(new Error("Cancelled"));
      } else {
        resolve({ exitCode, stdout: out, stderr: err });
      }
    });
    child.on("close", () => {
      var _a2;
      try {
        (_a2 = ctx.signal) == null ? void 0 : _a2.removeEventListener("abort", onAbort);
      } catch {
      }
    });
  });
}
var import_node_child_process2, import_node_os5;
var init_shell = __esm({
  "src/agent/workers/shell.ts"() {
    init_cjs_shims();
    import_node_child_process2 = require("child_process");
    import_node_os5 = __toESM(require("os"), 1);
    init_db();
    init_confirm();
  }
});

// electron/main.ts
init_cjs_shims();
var import_electron2 = require("electron");
var import_node_path9 = __toESM(require("path"), 1);
var import_node_url = require("url");

// src/agent/runtime.ts
init_cjs_shims();
var import_electron = require("electron");

// src/agent/scheduler.ts
init_cjs_shims();
init_research();
init_fileops();
init_shell();
init_db();

// src/agent/task_planner.ts
init_cjs_shims();
var import_zod = require("zod");
var import_node_fs5 = __toESM(require("fs"), 1);
var import_node_path5 = __toESM(require("path"), 1);
var import_node_os6 = __toESM(require("os"), 1);
var TaskSchema = import_zod.z.object({
  id: import_zod.z.string(),
  title: import_zod.z.string(),
  description: import_zod.z.string(),
  role: import_zod.z.enum(["orchestrator", "research", "fileops", "automation", "shell", "reviewer", "summarizer"]),
  deps: import_zod.z.array(import_zod.z.string()).default([]),
  budgets: import_zod.z.object({ tokens: import_zod.z.number().optional(), seconds: import_zod.z.number().optional() }).default({})
});
async function selectModel(client) {
  if (process.env.LMSTUDIO_MODEL && process.env.LMSTUDIO_MODEL.length > 0) {
    return process.env.LMSTUDIO_MODEL;
  }
  if (process.env.OLLAMA_MODEL && process.env.OLLAMA_MODEL.length > 0) {
    const name = process.env.OLLAMA_MODEL;
    return name.startsWith("ollama:") ? name : `ollama:${name}`;
  }
  try {
    const list = await client.models.list();
    const names = list.data.map((m) => m.id);
    const preferred = names.find((n) => n.includes("gpt-oss")) || names.find((n) => n.includes("20b")) || names.find((n) => n.includes("llama")) || names[0];
    if (preferred) return preferred;
  } catch {
  }
  return "local-model";
}
async function routeIntentLLM(prompt, model) {
  var _a, _b, _c, _d;
  try {
    const isOllama = typeof model === "string" && model.startsWith("ollama:");
    const sys = [
      "You are an intent router for a macOS local assistant.",
      "Return STRICT JSON only, no prose.",
      "Schema:",
      '{"op":"locate|list|open|reveal|mkdir|rename|move|copy|open_app|quit_app|focus_app|hide_app|restart_app|ocr_search|shell|none"',
      ',"name?":string, "scope?":"desktop|documents|downloads|pictures|any"',
      ',"listType?":"files|folders"',
      ',"src?":string, "dest?":string, "action?":"open|reveal"',
      ',"text?":string, "cmd?":string}',
      'Rules: prefer concise fields; infer scope if user mentions a location; for list intents set op="list" with listType; if the user asks to search images by text, set op="ocr_search" and text to the phrase; if no actionable intent, set op="none".'
    ].join(" ");
    if (isOllama) {
      const base = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
      const r = await fetch(base + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.replace(/^ollama:/, ""),
          stream: false,
          options: { temperature: 0.1, num_predict: 300 },
          messages: [
            { role: "system", content: sys },
            { role: "user", content: prompt }
          ]
        })
      });
      if (!r.ok) return null;
      const j = await r.json();
      const content = (_a = j == null ? void 0 : j.message) == null ? void 0 : _a.content;
      if (!content || typeof content !== "string") return null;
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.op === "string") return parsed;
    } else {
      const baseURL = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
      const body = {
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 300,
        reasoning_effort: "medium"
      };
      const r = await fetch(baseURL.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) return null;
      const j = await r.json();
      const content = (_d = (_c = (_b = j == null ? void 0 : j.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content;
      if (!content || typeof content !== "string") return null;
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.op === "string") return parsed;
    }
  } catch {
  }
  return null;
}
function detectLocateTask(prompt) {
  var _a, _b;
  const p = prompt.trim();
  try {
    const j = JSON.parse(p);
    if (j && j.op === "locate" && typeof j.name === "string") {
      return [
        { id: "locate", title: "Locate file/folder", description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }
      ];
    }
  } catch {
  }
  if (/\b(file|folder)\b/i.test(p)) {
    const nearNamed = p.match(/(?:named|called|something\s+like)\s+["']([^"']+)["']/i);
    if (nearNamed && nearNamed[1]) {
      const scopeWord = (((_a = p.match(/\bon\s+(?:my\s+)?(desktop|documents|downloads|pictures)\b/i)) == null ? void 0 : _a[1]) || "").toLowerCase();
      const scope = ["desktop", "documents", "downloads", "pictures"].includes(scopeWord) ? scopeWord : "any";
      const payload = { op: "locate", name: nearNamed[1].trim(), scope, originalPrompt: p };
      return [{ id: "locate", title: "Locate file/folder", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
    }
    const quotes = Array.from(p.matchAll(/["']([^"']+)["']/g));
    if (quotes.length > 0) {
      const name = quotes[quotes.length - 1][1].trim();
      const scopeWord = (((_b = p.match(/\bon\s+(?:my\s+)?(desktop|documents|downloads|pictures)\b/i)) == null ? void 0 : _b[1]) || "").toLowerCase();
      const scope = ["desktop", "documents", "downloads", "pictures"].includes(scopeWord) ? scopeWord : "any";
      const payload = { op: "locate", name, scope, originalPrompt: p };
      return [{ id: "locate", title: "Locate file/folder", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
    }
  }
  const patterns = [
    // Direct requests
    /where\s+is\s+(?:a|the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /find\s+(?:a|the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /locate\s+(?:a|the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    // Conversational patterns
    /I\s+(?:think\s+)?(?:have|had)\s+a\s+(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    /(?:there's|there\s+is)\s+a\s+(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    /I\s+(?:can't\s+remember\s+where|lost|misplaced).*?(?:file|folder).*?["'](.+?)["']/i,
    /(?:somewhere\s+on\s+my\s+(?:laptop|computer|mac)).*?(?:file|folder).*?(?:called|named).*?["'](.+?)["']/i,
    // Pattern for "I think it's called something like..."
    /(?:I\s+think\s+)?(?:it's\s+called|named)\s+something\s+like.*?["'](.+?)["']/i,
    // Pattern without quotes for names with special characters (more precise)
    /(?:it's\s+called|named)\s+something\s+like\s+"([^"]+)"/i
  ];
  const listFolders = p.match(/\b(list|show|find)\s+(?:all\s+)?(folders|directories)\s+(?:in|on)\s+(?:the\s+)?(?:my\s+)?(desktop|documents|downloads|pictures)\b/i);
  if (listFolders) {
    const scope = (listFolders[3] || "any").toLowerCase();
    const payload = { op: "locate", name: "*", scope, listType: "folders" };
    return [{ id: "locate", title: "List folders", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
  }
  const listFiles = p.match(/\b(list|show)\s+(?:all\s+)?files\s+(?:in|on)\s+(?:the\s+)?(?:my\s+)?(desktop|documents|downloads|pictures)\b/i);
  if (listFiles) {
    const scope = (listFiles[2] || "any").toLowerCase();
    const payload = { op: "locate", name: "*", scope, listType: "files" };
    return [{ id: "locate", title: "List files", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
  }
  const contentSearchIndicators = [
    /screenshot.*?(?:with|has|contains).*?text/i,
    /image.*?(?:with|has|contains).*?text/i,
    /(?:text|words).*?(?:in|inside).*?(?:screenshot|image|picture)/i,
    /(?:screenshot|image|picture).*?(?:says|contains|has).*?["'](.+?)["']/i,
    /(?:find|locate).*?(?:screenshot|image).*?(?:text|content|saying)/i,
    /what.*?text.*?(?:do you see|in this image|in the image)/i,
    /(?:read|extract).*?text.*?(?:from|in).*?(?:image|this)/i,
    /(?:what does|what's in).*?(?:this|the).*?image.*?say/i
  ];
  let isContentSearch = false;
  let contentSearchText = "";
  for (const indicator of contentSearchIndicators) {
    const match = p.match(indicator);
    if (match) {
      isContentSearch = true;
      const textMatch = p.match(/["']([^"']+)["']/i);
      if (textMatch) {
        contentSearchText = textMatch[1];
      } else {
        const generalOcrPatterns = [
          /what.*?text.*?(?:do you see|in this image|in the image)/i,
          /(?:read|extract).*?text.*?(?:from|in).*?(?:image|this)/i,
          /(?:what does|what's in).*?(?:this|the).*?image.*?say/i
        ];
        const isGeneralOcr = generalOcrPatterns.some((pattern) => pattern.test(p));
        if (isGeneralOcr) {
          contentSearchText = "*";
        } else {
          const words = p.split(/\s+/).filter((w) => w.length > 3);
          contentSearchText = words.slice(-3).join(" ");
        }
      }
      break;
    }
  }
  if (isContentSearch && contentSearchText) {
    const payload = { op: "locate", name: contentSearchText, scope: "any", contentSearch: true, originalPrompt: p };
    return [
      { id: "locate", title: "Search images for text content", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }
    ];
  }
  for (const r of patterns) {
    const m = p.match(r);
    if (m && m[1]) {
      const rawName = m[1].trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      const scopeWord = (m[3] || "").toLowerCase();
      const scope = ["desktop", "documents", "downloads", "pictures"].includes(scopeWord) ? scopeWord : "any";
      const mightNeedContentSearch = /screenshot|image|picture/i.test(p) || /text.*(?:in|inside|contains)/i.test(p) || /(?:says|contains|has).*text/i.test(p);
      const payload = {
        op: "locate",
        name: rawName,
        scope,
        contentSearch: mightNeedContentSearch,
        originalPrompt: p
      };
      const title = mightNeedContentSearch ? "Search for files and image content" : "Locate file/folder";
      return [
        { id: "locate", title, description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }
      ];
    }
  }
  if (/\b(file|folder)\b/i.test(p)) {
    const m = p.match(/(?:named|called|something\s+like)\s+([^"'\n]+?)(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures)\b|[.!?]|$)/i);
    if (m && m[1]) {
      const extracted = m[1].trim().replace(/^\b(a|the)\b\s*/i, "");
      const scopeWord = (m[2] || "").toLowerCase();
      const scope = ["desktop", "documents", "downloads", "pictures"].includes(scopeWord) ? scopeWord : "any";
      const payload = { op: "locate", name: extracted, scope, originalPrompt: p };
      return [{ id: "locate", title: "Locate file/folder", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
    }
  }
  return null;
}
function detectOpenTask(prompt) {
  const p = prompt.trim();
  const open = p.match(/\b(?:open|launch)\s+(?:the\s+)?(?:folder|file)?\s*"?([^"]+?)"?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures))?\b/i);
  if (open && open[1]) {
    const name = open[1].trim();
    const scope = (open[2] || "any").toLowerCase();
    const payload = { op: "open", action: "open", name, scope };
    return [{ id: "open", title: `Open ${name}`, description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
  }
  const reveal = p.match(/\b(?:show|reveal)\s+(?:the\s+)?(?:folder|file)?\s*"?([^"]+?)"?(?:\s+in\s+finder)?(?:\s+on\s+(?:my\s+)?(desktop|documents|downloads|pictures))?\b/i);
  if (reveal && reveal[1]) {
    const name = reveal[1].trim();
    const scope = (reveal[2] || "any").toLowerCase();
    const payload = { op: "open", action: "reveal", name, scope };
    return [{ id: "open", title: `Reveal ${name}`, description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
  }
  return null;
}
function detectAppOpenTask(prompt) {
  const p = prompt.trim();
  const m = p.match(/\b(?:open|launch|start)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i);
  if (!m || !m[1]) return null;
  let raw = m[1].trim();
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, "").trim();
  if (!raw) return null;
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw);
  const cmd = `open -a "${canonical}"`;
  return [
    { id: "open_app", title: `Open ${canonical}`, description: JSON.stringify({ cmd }), role: "shell", deps: [], budgets: {} }
  ];
}
function detectAppQuitTask(prompt) {
  const p = prompt.trim();
  const m = p.match(/\b(?:quit|close|exit|kill)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i);
  if (!m || !m[1]) return null;
  let raw = m[1].trim();
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, "").trim();
  if (!raw) return null;
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw);
  const cmd = `osascript -e 'tell application "${canonical}" to quit'`;
  return [
    { id: "quit_app", title: `Quit ${canonical}`, description: JSON.stringify({ cmd }), role: "shell", deps: [], budgets: {} }
  ];
}
function detectAppFocusTask(prompt) {
  const p = prompt.trim();
  const m = p.match(/\b(?:focus|switch\s+to|bring\s+(?:it|app|application)?\s*to\s+front|show)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i);
  if (!m || !m[1]) return null;
  let raw = m[1].trim();
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, "").trim();
  if (!raw) return null;
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw);
  const cmd = `osascript -e 'tell application "${canonical}" to activate'`;
  return [{ id: "focus_app", title: `Focus ${canonical}`, description: JSON.stringify({ cmd }), role: "shell", deps: [], budgets: {} }];
}
function detectAppHideTask(prompt) {
  const p = prompt.trim();
  const m = p.match(/\b(?:hide|minimise|minimize)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i);
  if (!m || !m[1]) return null;
  let raw = m[1].trim();
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, "").trim();
  if (!raw) return null;
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw);
  const cmd = `osascript -e 'tell application "${canonical}" to hide'`;
  return [{ id: "hide_app", title: `Hide ${canonical}`, description: JSON.stringify({ cmd }), role: "shell", deps: [], budgets: {} }];
}
function detectAppRestartTask(prompt) {
  const p = prompt.trim();
  const m = p.match(/\b(?:restart|relaunch|reopen)\s+(?:the\s+)?(?:(?:app(?:lication)?|program)\s+)?([A-Za-z0-9 .+&_:\-]+?)(?:\s+app(?:lication)?)?(?:[.!?]|\s*$)/i);
  if (!m || !m[1]) return null;
  let raw = m[1].trim();
  raw = raw.replace(/\s*(?:please|for\s+me|now)\s*$/i, "").trim();
  if (!raw) return null;
  const canonical = resolveAppName(raw) || canonicalizeAppName(raw);
  const quitCmd = `osascript -e 'tell application "${canonical}" to quit'`;
  const openCmd = `open -a "${canonical}"`;
  return [
    { id: "quit_app", title: `Quit ${canonical}`, description: JSON.stringify({ cmd: quitCmd }), role: "shell", deps: [], budgets: {} },
    { id: "open_app", title: `Open ${canonical}`, description: JSON.stringify({ cmd: openCmd }), role: "shell", deps: ["quit_app"], budgets: {} }
  ];
}
function canonicalizeAppName(name) {
  const n = name.trim();
  const lower = n.toLowerCase();
  const map = {
    "slack": "Slack",
    "chrome": "Google Chrome",
    "google chrome": "Google Chrome",
    "safari": "Safari",
    "finder": "Finder",
    "terminal": "Terminal",
    "iterm": "iTerm",
    "iterm2": "iTerm",
    "vscode": "Visual Studio Code",
    "vs code": "Visual Studio Code",
    "code": "Visual Studio Code",
    "xcode": "Xcode",
    "notes": "Notes",
    "messages": "Messages",
    "mail": "Mail",
    "outlook": "Microsoft Outlook",
    "ms outlook": "Microsoft Outlook",
    "microsoft outlook": "Microsoft Outlook",
    "preview": "Preview",
    "calendar": "Calendar",
    "reminders": "Reminders",
    "spotify": "Spotify",
    "discord": "Discord",
    "zoom": "zoom.us",
    "system preferences": "System Settings",
    "settings": "System Settings"
  };
  if (map[lower]) return map[lower];
  const titleCase = n.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
  return titleCase;
}
function resolveAppName(input) {
  const normalizedInput = normalizeAppName(input);
  const candidates = /* @__PURE__ */ new Set();
  for (const a of KNOWN_APPS) candidates.add(a);
  for (const a of getInstalledApps()) candidates.add(a);
  const normInput = normalizeForCompare(normalizedInput);
  for (const cand of candidates) {
    const normCand = normalizeForCompare(cand);
    if (normCand.includes(normInput) || normInput.includes(normCand)) {
      return cand;
    }
  }
  let best = null;
  for (const cand of candidates) {
    const normCand = normalizeForCompare(cand);
    if (normCand === normInput) return cand;
    if (normCand[0] !== normInput[0]) continue;
    const score = similarity(normInput, normCand);
    if (!best || score > best.score) best = { name: cand, score };
  }
  if (best && best.score >= 0.75) return best.name;
  return null;
}
var KNOWN_APPS = [
  "Slack",
  "Google Chrome",
  "Visual Studio Code",
  "Safari",
  "Finder",
  "Terminal",
  "iTerm",
  "Xcode",
  "Notes",
  "Messages",
  "Mail",
  "Preview",
  "Calendar",
  "Reminders",
  "Spotify",
  "Discord",
  "zoom.us",
  "Zoom",
  "System Settings",
  "Microsoft Outlook",
  "Arc",
  "Firefox",
  "Notion",
  "Obsidian",
  "Postman",
  "TablePlus",
  "Docker",
  "WhatsApp",
  "Telegram",
  "Signal",
  "1Password",
  "Raycast",
  "Figma",
  "Microsoft Word",
  "Microsoft Excel",
  "Microsoft PowerPoint"
];
var installedAppsCache = null;
function getInstalledApps() {
  if (installedAppsCache) return installedAppsCache;
  const roots = [
    "/Applications",
    "/System/Applications",
    import_node_path5.default.join(import_node_os6.default.homedir(), "Applications"),
    "/Applications/Utilities"
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const root of roots) {
    try {
      const entries = import_node_fs5.default.readdirSync(root, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && ent.name.endsWith(".app")) {
          const base = ent.name.replace(/\.app$/i, "");
          if (!seen.has(base)) seen.add(base);
        }
      }
    } catch {
    }
  }
  installedAppsCache = Array.from(seen);
  return installedAppsCache;
}
function normalizeAppName(s) {
  return s.replace(/\.app$/i, "").trim();
}
function normalizeForCompare(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function similarity(a, b) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const denom = Math.max(a.length, b.length);
  return denom === 0 ? 0 : 1 - dist / denom;
}
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
function detectRenameTask(prompt) {
  const p = prompt.trim();
  try {
    const j = JSON.parse(p);
    if (j && j.op === "rename" && typeof j.src === "string" && typeof j.dest === "string") {
      return [
        { id: "rename", title: "Rename file", description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }
      ];
    }
  } catch {
  }
  const m = p.match(/rename\s+['\"]?(.+?)['\"]?\s+(?:to|->)\s+['\"]?(.+?)['\"]?$/i);
  if (m && m[1] && m[2]) {
    const payload = { op: "rename", src: m[1], dest: m[2] };
    return [
      { id: "rename", title: "Rename file", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }
    ];
  }
  const m2 = p.match(/rename\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?(.+?)\s+(?:on\s+my\s+desktop|on\s+desktop)?\s+(?:to|->)\s+(.+)$/i);
  if (m2 && m2[1] && m2[2]) {
    const payload = { op: "rename", src: `Desktop ${m2[1]}`.trim(), dest: m2[2].trim() };
    return [
      { id: "rename", title: "Rename file", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }
    ];
  }
  return null;
}
async function planTasks(prompt, modelOverride, deep, automation) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  try {
    const j = JSON.parse(prompt);
    if (j && typeof j === "object") {
      if (j.op === "shell" && typeof j.cmd === "string") {
        return [{ id: "sh1", title: "Run shell command", description: JSON.stringify({ cmd: j.cmd, meta: j.meta }), role: "shell", deps: [], budgets: {} }];
      }
      if (j.op === "open" && typeof j.name === "string") {
        return [{ id: "open", title: `Open ${j.name}`, description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }];
      }
      if (j.op === "rename" && typeof j.src === "string" && typeof j.dest === "string") {
        return [{ id: "rename", title: "Rename file", description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }];
      }
      if (j.op === "locate" && typeof j.name === "string") {
        return [{ id: "locate", title: "Locate", description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }];
      }
      if (j.op === "ocr_search" && (typeof j.text === "string" || j.text === "*")) {
        return [{ id: "ocr", title: "OCR search", description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }];
      }
      if (j.op === "mkdir" && typeof j.name === "string") {
        return [{ id: "mkdir", title: `Create folder ${j.name}`, description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }];
      }
      if (j.op === "move" && typeof j.src === "string" && typeof j.dest === "string") {
        return [{ id: "move", title: "Move item", description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }];
      }
      if (j.op === "copy" && typeof j.src === "string" && typeof j.dest === "string") {
        return [{ id: "copy", title: "Copy item", description: JSON.stringify(j), role: "fileops", deps: [], budgets: {} }];
      }
    }
  } catch {
  }
  const uploadedImageMatch = prompt.match(/\[UPLOADED_IMAGE_PATH:([^\]]+)\]\s*(.*)/);
  if (uploadedImageMatch) {
    const imagePath = uploadedImageMatch[1];
    const userQuestion = uploadedImageMatch[2].trim();
    console.log("Detected uploaded image:", imagePath);
    console.log("User question:", userQuestion);
    const searchText = userQuestion.toLowerCase().includes("what") && userQuestion.toLowerCase().includes("text") ? "*" : userQuestion || "*";
    const payload = {
      op: "ocr_search",
      text: searchText,
      paths: [imagePath],
      // Only process this specific image
      originalPrompt: userQuestion || "What text do you see in this image?"
    };
    return [
      {
        id: "ocr_uploaded",
        title: "Extract text from uploaded image",
        description: JSON.stringify(payload),
        role: "fileops",
        deps: [],
        budgets: {}
      }
    ];
  }
  const quitPlan = detectAppQuitTask(prompt);
  if (quitPlan) return quitPlan;
  const focusPlan = detectAppFocusTask(prompt);
  if (focusPlan) return focusPlan;
  const hidePlan = detectAppHideTask(prompt);
  if (hidePlan) return hidePlan;
  const restartPlan = detectAppRestartTask(prompt);
  if (restartPlan) return restartPlan;
  const appOpenPlan = detectAppOpenTask(prompt);
  if (appOpenPlan) return appOpenPlan;
  const openPlan = detectOpenTask(prompt);
  if (openPlan) return openPlan;
  const locatePlan = detectLocateTask(prompt);
  if (locatePlan) return locatePlan;
  const renamePlan = detectRenameTask(prompt);
  if (renamePlan) return renamePlan;
  const shellPlan = detectShellTask(prompt);
  if (shellPlan) return shellPlan;
  if (automation) {
    try {
      const baseURL2 = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
      const client2 = {
        models: { list: async () => await (await fetch(baseURL2.replace(/\/$/, "") + "/models")).json() }
      };
      let modelName2 = modelOverride ?? await selectModel(client2);
      const routed = await routeIntentLLM(prompt, modelName2);
      if (routed && routed.op && routed.op !== "none") {
        switch (routed.op) {
          case "list": {
            const scope = routed.scope || "any";
            const listType = routed.listType || "folders";
            const payload = { op: "locate", name: "*", scope, listType };
            return [{ id: "locate", title: `List ${listType}`, description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
          }
          case "locate": {
            const payload = { op: "locate", name: routed.name || "*", scope: routed.scope || "any", originalPrompt: prompt };
            return [{ id: "locate", title: "Locate file/folder", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
          }
          case "ocr_search": {
            const payload = { op: "ocr_search", text: routed.text || "*", paths: [], originalPrompt: prompt };
            return [{ id: "ocr", title: "Search images for text content", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
          }
          case "mkdir": {
            if (routed.name) return [{ id: "mkdir", title: `Create folder ${routed.name}`, description: JSON.stringify({ op: "mkdir", name: routed.name, scope: routed.scope || "documents" }), role: "fileops", deps: [], budgets: {} }];
            break;
          }
          case "rename": {
            if (routed.src && routed.dest) return [{ id: "rename", title: "Rename file", description: JSON.stringify({ op: "rename", src: routed.src, dest: routed.dest }), role: "fileops", deps: [], budgets: {} }];
            break;
          }
          case "move": {
            if (routed.src && routed.dest) return [{ id: "move", title: "Move item", description: JSON.stringify({ op: "move", src: routed.src, dest: routed.dest }), role: "fileops", deps: [], budgets: {} }];
            break;
          }
          case "copy": {
            if (routed.src && routed.dest) return [{ id: "copy", title: "Copy item", description: JSON.stringify({ op: "copy", src: routed.src, dest: routed.dest }), role: "fileops", deps: [], budgets: {} }];
            break;
          }
          case "open_app": {
            if (routed.name) return [{ id: "open_app", title: `Open ${routed.name}`, description: JSON.stringify({ cmd: `open -a "${routed.name}"` }), role: "shell", deps: [], budgets: {} }];
            break;
          }
          case "quit_app": {
            if (routed.name) return [{ id: "quit_app", title: `Quit ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to quit'` }), role: "shell", deps: [], budgets: {} }];
            break;
          }
          case "focus_app": {
            if (routed.name) return [{ id: "focus_app", title: `Focus ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to activate'` }), role: "shell", deps: [], budgets: {} }];
            break;
          }
          case "hide_app": {
            if (routed.name) return [{ id: "hide_app", title: `Hide ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to hide'` }), role: "shell", deps: [], budgets: {} }];
            break;
          }
          case "restart_app": {
            if (routed.name) return [
              { id: "quit_app", title: `Quit ${routed.name}`, description: JSON.stringify({ cmd: `osascript -e 'tell application "${routed.name}" to quit'` }), role: "shell", deps: [], budgets: {} },
              { id: "open_app", title: `Open ${routed.name}`, description: JSON.stringify({ cmd: `open -a "${routed.name}"` }), role: "shell", deps: ["quit_app"], budgets: {} }
            ];
            break;
          }
          case "shell": {
            if (routed.cmd) return [{ id: "sh1", title: "Run shell command", description: JSON.stringify({ cmd: routed.cmd }), role: "shell", deps: [], budgets: {} }];
            break;
          }
        }
      }
    } catch {
    }
  }
  const taskFocus = automation ? "Mac control, file operations, shell commands, browser automation" : "web research, information gathering, analysis, synthesis";
  const preferredRoles = automation ? "fileops (local file edits), shell (terminal commands), automation (browser/app control)" : "research (web), reviewer (analysis), fileops (summary writing)";
  const system = `You are a local orchestrator that breaks a single user task into a small DAG of concrete steps.
Return 2-5 tasks max, each with an id, title, description, role, deps (by id), and tiny budgets.

${automation ? "TASK MODE" : "RESEARCH MODE"}: Focus on ${taskFocus}.
Use roles: ${preferredRoles}. Prefer reversible steps first.

${automation ? "For task mode: Prioritize direct actions like file operations, shell commands, opening apps, browser automation." : "For research mode: Prioritize web research, data gathering, analysis, and report generation."}

Platform context: ${process.platform === "win32" ? "Windows PowerShell environment - use PowerShell commands like Get-ChildItem, Get-Location, etc." : "macOS/Unix environment - use standard Unix commands like ls, pwd, etc."}

Respond with valid JSON only, no other text.`;
  const baseURL = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
  const client = {
    chat: {
      completions: {
        create: async (body) => {
          const r = await fetch(baseURL.replace(/\/$/, "") + "/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: body.model, messages: body.messages, temperature: 0.2 })
          });
          const j = await r.json();
          return j;
        }
      }
    },
    models: {
      list: async () => {
        const r = await fetch(baseURL.replace(/\/$/, "") + "/models");
        const j = await r.json();
        return j;
      }
    }
  };
  let modelName = modelOverride ?? await selectModel(client);
  let textFromLLM = null;
  const isOllama = typeof modelName === "string" && modelName.startsWith("ollama:");
  try {
    if (isOllama) {
      const base = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
      const r = await fetch(base + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName.replace(/^ollama:/, ""),
          stream: false,
          options: { temperature: 0.2, num_predict: 600 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
          ]
        })
      });
      if (r.ok) {
        const j = await r.json();
        textFromLLM = String(((_a = j == null ? void 0 : j.message) == null ? void 0 : _a.content) || "");
      }
    } else {
      const resp = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 300
      });
      textFromLLM = String(((_d = (_c = (_b = resp == null ? void 0 : resp.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) ?? "");
    }
  } catch (e) {
    modelName = isOllama ? modelName : "local-model";
    if (isOllama) {
      try {
        const base = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
        const r = await fetch(base + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelName.replace(/^ollama:/, ""),
            stream: false,
            options: { temperature: 0.2, num_predict: 500 },
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt }
            ]
          })
        });
        if (r.ok) {
          const j = await r.json();
          textFromLLM = String(((_e = j == null ? void 0 : j.message) == null ? void 0 : _e.content) || "");
        }
      } catch {
      }
    } else {
      try {
        const resp = await client.chat.completions.create({
          model: modelName,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 300
        });
        textFromLLM = String(((_h = (_g = (_f = resp == null ? void 0 : resp.choices) == null ? void 0 : _f[0]) == null ? void 0 : _g.message) == null ? void 0 : _h.content) ?? "");
      } catch {
      }
    }
  }
  let tasks = [];
  try {
    const parsed = JSON.parse(String(textFromLLM || ""));
    const maybeArray = Array.isArray(parsed) ? parsed : parsed.tasks;
    tasks = import_zod.z.array(TaskSchema).parse(maybeArray);
  } catch (e) {
    if (automation) {
      const p = prompt.toLowerCase();
      const scopeMatch = p.match(/\b(desktop|documents|downloads|pictures)\b/);
      const scope = scopeMatch ? scopeMatch[1] : "any";
      const isList = /\b(list|show)\b/.test(p);
      const wantsFolders = /\bfolders?|directories\b/.test(p);
      const wantsFiles = /\bfiles?\b/.test(p);
      if (isList && (wantsFolders || wantsFiles)) {
        const payload = { op: "locate", name: "*", scope, listType: wantsFolders ? "folders" : "files" };
        tasks = [{ id: "locate", title: `List ${wantsFolders ? "folders" : "files"}`, description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
      } else if (p.includes("folder") || p.includes("file")) {
        const payload = { op: "locate", name: "*", scope };
        tasks = [{ id: "locate", title: "Search for file/folder", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
      } else {
        tasks = [
          { id: "t1", title: "Analyze request", description: `Understand what needs to be done: ${prompt}`, role: "fileops", deps: [], budgets: {} },
          { id: "t2", title: "Execute task", description: prompt, role: "shell", deps: ["t1"], budgets: {} }
        ];
      }
    } else if (deep) {
      tasks = [
        { id: "r1", title: "Initial web scan", description: prompt, role: "research", deps: [], budgets: {} },
        { id: "r2", title: "Broaden sources", description: `${prompt} additional perspectives`, role: "research", deps: [], budgets: {} },
        { id: "s1", title: "Synthesize and debate", description: "Compare findings, note conflicts, pick best-supported claims", role: "reviewer", deps: ["r1", "r2"], budgets: {} },
        { id: "w1", title: "Write Summary", description: "Create a local summary file", role: "fileops", deps: ["s1"], budgets: {} }
      ];
    } else {
      tasks = [
        { id: "r1", title: "Quick web scan", description: prompt, role: "research", deps: [], budgets: {} },
        { id: "w1", title: "Write Summary", description: "Create a local summary file", role: "fileops", deps: ["r1"], budgets: {} }
      ];
    }
  }
  return tasks;
}
function detectShellTask(prompt) {
  const p = prompt.trim();
  try {
    const j = JSON.parse(p);
    if (j && j.op === "shell" && typeof j.cmd === "string") {
      return [
        { id: "sh1", title: "Run shell command", description: JSON.stringify({ cmd: j.cmd }), role: "shell", deps: [], budgets: {} }
      ];
    }
  } catch {
  }
  const m = p.match(/^(?:shell:|run:|execute:)\s*(.+)$/i);
  if (m && m[1]) {
    const payload = { cmd: m[1].trim() };
    return [
      { id: "sh1", title: "Run shell command", description: JSON.stringify(payload), role: "shell", deps: [], budgets: {} }
    ];
  }
  return null;
}

// src/agent/graph.ts
init_cjs_shims();
var import_langgraph = require("@langchain/langgraph");
var import_node_fs6 = __toESM(require("fs"), 1);
init_db();
var ResearchState = import_langgraph.Annotation.Root({
  prompt: (0, import_langgraph.Annotation)({ value: (_prev, next) => next }),
  deep: (0, import_langgraph.Annotation)({ value: (_prev, next) => next, default: () => false }),
  // artifacts
  targets: (0, import_langgraph.Annotation)({ value: (_prev, next) => next, default: () => [] }),
  aggregatePath: (0, import_langgraph.Annotation)({ value: (_prev, next) => next }),
  synthesis: (0, import_langgraph.Annotation)({ value: (_prev, next) => next }),
  snippets: (0, import_langgraph.Annotation)({ value: (_prev, next) => next, default: () => [] }),
  selected: (0, import_langgraph.Annotation)({ value: (_prev, next) => next, default: () => [] })
});
async function prepareNode(_state) {
  return {};
}
function parseAggregate(aggregatePath) {
  try {
    if (!aggregatePath || !import_node_fs6.default.existsSync(aggregatePath)) return [];
    const raw = import_node_fs6.default.readFileSync(aggregatePath, "utf8");
    const blocks = raw.split(/\n---\n\n?/);
    const out = [];
    for (const b of blocks) {
      const mTitle = b.match(/^#\s+(.+)$/m);
      const mUrl = b.match(/^https?:\/\/\S+/m);
      const quote = b.split(/\n\n/).slice(2).join("\n").trim() || b.trim();
      if (mTitle && mUrl) {
        const title = mTitle[1].trim();
        const url = mUrl[0].trim();
        const snippet = quote.replace(/^>\s?/gm, "").trim();
        if (snippet) out.push({ title, url, snippet });
      }
    }
    return out;
  } catch {
    return [];
  }
}
async function extractNode(state) {
  db.addRunEvent(state.runId ?? "", { type: "graph_extract_start", message: "Extracting snippets from aggregate" });
  const snippets = parseAggregate(state.aggregatePath);
  db.addRunEvent(state.runId ?? "", { type: "graph_extract_done", count: snippets.length });
  return { snippets };
}
async function synthesizeNode(state) {
  var _a, _b, _c, _d, _e;
  db.addRunEvent(state.runId ?? "", { type: "graph_synthesize_start", message: "Synthesizing final report" });
  const baseURL = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
  async function getFetch2() {
    const g = globalThis;
    if (typeof g.fetch === "function") return g.fetch.bind(globalThis);
    const mod = await import("node-fetch");
    return mod.default;
  }
  let model = process.env.LMSTUDIO_MODEL ?? (process.env.OLLAMA_MODEL ? process.env.OLLAMA_MODEL.startsWith("ollama:") ? process.env.OLLAMA_MODEL : `ollama:${process.env.OLLAMA_MODEL}` : "local-model");
  try {
    const doFetch2 = await getFetch2();
    const resp = await doFetch2(baseURL.replace(/\/$/, "") + "/models");
    if (resp.ok) {
      const data = await resp.json();
      model = ((_b = (_a = data == null ? void 0 : data.data) == null ? void 0 : _a[0]) == null ? void 0 : _b.id) ?? model;
    }
  } catch {
  }
  let corpus = "";
  if (state.aggregatePath && import_node_fs6.default.existsSync(state.aggregatePath)) {
    try {
      corpus = import_node_fs6.default.readFileSync(state.aggregatePath, "utf8");
      if (corpus.length > 16e3) corpus = corpus.slice(0, 16e3);
    } catch {
    }
  }
  const sourcesList = state.targets.map((t, i) => `[${i + 1}] ${t.title} - ${t.url}`).join("\n");
  const snippetList = (state.selected.length > 0 ? state.selected : state.snippets).slice(0, 8).map((s, i) => `S${i + 1}: ${s.title} (${s.url})
${s.snippet}`).join("\n\n");
  const prompt = `You are an expert technical analyst. Synthesize multiple sources into actionable insights.
Requirements:
- Produce 5-7 concise bullet takeaways that synthesize (do not list headlines)
- Use inline citations [1], [2] referencing the numbered Sources below
- Add a short implications paragraph for practitioners

Question: ${state.prompt}
Sources:
${sourcesList || "[none]"}
Key snippets (truncated):
${snippetList || "[no snippets]"}
Corpus (truncated):
${corpus || "[no corpus available]"}`;
  const messages = [
    { role: "system", content: "Act as a meticulous analyst that cites sources and avoids hallucinations. Produce 5-7 concise bullets with inline [n] citations, then a 2-3 sentence implications paragraph for practitioners. If sources are weak or conflicting, note limitations explicitly." },
    { role: "user", content: prompt }
  ];
  const doFetch = await getFetch2();
  let text = "No synthesis generated";
  try {
    const resp = await doFetch(baseURL.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer not-needed" },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 700 })
    });
    if (resp.ok) {
      const data = await resp.json();
      text = ((_e = (_d = (_c = data == null ? void 0 : data.choices) == null ? void 0 : _c[0]) == null ? void 0 : _d.message) == null ? void 0 : _e.content) ?? text;
    }
  } catch {
  }
  db.addRunEvent(state.runId ?? "", { type: "graph_synthesize_done" });
  return { synthesis: text };
}
async function finalizeNode(state) {
  void state;
  return new import_langgraph.Command({ goto: import_langgraph.END });
}
function buildResearchGraph() {
  const g = new import_langgraph.StateGraph(ResearchState).addNode("prepare", prepareNode).addNode("extract", extractNode).addNode("synthesize", synthesizeNode).addNode("finalize", finalizeNode).addEdge(import_langgraph.START, "prepare").addEdge("prepare", "extract").addEdge("extract", "synthesize").addEdge("synthesize", "finalize").compile();
  return g;
}

// src/agent/scheduler.ts
var import_node_fs7 = __toESM(require("fs"), 1);
var import_node_os7 = __toESM(require("os"), 1);
var import_node_path6 = __toESM(require("path"), 1);
var activeRuns = /* @__PURE__ */ new Map();
function envRoleConcurrency(role) {
  const key = `AGENT_ROLE_CONCURRENCY_${role.toUpperCase()}`;
  const raw = process.env[key];
  if (!raw) return void 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : void 0;
}
function defaultRoleConcurrency(role) {
  const env = envRoleConcurrency(role);
  if (env != null) return env;
  const map = {
    research: 2,
    fileops: 3,
    shell: 1,
    reviewer: 1
  };
  return map[role];
}
function createLimiter(max) {
  if (max == null || max <= 0 || !Number.isFinite(max)) {
    return async function(fn) {
      return fn();
    };
  }
  let active = 0;
  const queue = [];
  const runNext = () => {
    if (active >= max) return;
    const next = queue.shift();
    if (!next) return;
    active++;
    next();
  };
  return async function limit(fn) {
    return new Promise((resolve, reject) => {
      const task = () => {
        fn().then((v) => {
          active--;
          runNext();
          resolve(v);
        }, (e) => {
          active--;
          runNext();
          reject(e);
        });
      };
      if (active < max) {
        active++;
        task();
      } else {
        queue.push(task);
      }
    });
  };
}
function tasksToMermaid(tasks) {
  const lines = ["graph TD"];
  for (const t of tasks) {
    const label = `${t.title.replace(/"/g, '\\"')} (${t.role})`;
    lines.push(`${t.id}["${label}"]`);
  }
  for (const t of tasks) {
    for (const d of t.deps) {
      lines.push(`${d} --> ${t.id}`);
    }
  }
  return lines.join("\n");
}
async function startOrchestrator(input) {
  const controller = new AbortController();
  activeRuns.set(input.runId, controller);
  try {
    const tasks = await planTasks(input.prompt, input.model, input.deep, input.automation);
    db.addRunEvent(input.runId, { type: "plan", tasks });
    try {
      const mermaid = tasksToMermaid(tasks);
      db.addRunEvent(input.runId, { type: "plan_mermaid", mermaid });
    } catch {
    }
    if (input.dryRun) {
      db.addRunEvent(input.runId, { type: "dry_run" });
      db.completeRun(input.runId);
      return;
    }
    const done = /* @__PURE__ */ new Set();
    const started = /* @__PURE__ */ new Set();
    while (done.size < tasks.length) {
      if (controller.signal.aborted) {
        db.addRunEvent(input.runId, { type: "run_cancelled" });
        break;
      }
      const wave = tasks.filter((t) => !started.has(t.id) && t.deps.every((d) => done.has(d)));
      if (wave.length === 0) {
        const remaining = tasks.filter((t) => !done.has(t.id));
        for (const t of remaining) {
          db.updateTaskStatus(input.runId, t.id, "failed", { title: t.title, role: t.role });
          db.addRunEvent(input.runId, { type: "error", taskId: t.id, message: "Unresolvable dependencies", deps: t.deps });
          done.add(t.id);
        }
        break;
      }
      for (const t of wave) started.add(t.id);
      const limiters = /* @__PURE__ */ new Map();
      const getLimiter = (role) => {
        const ex = limiters.get(role);
        if (ex) return ex;
        const lim = createLimiter(defaultRoleConcurrency(role));
        limiters.set(role, lim);
        return lim;
      };
      await Promise.all(wave.map((t) => {
        const limiter = getLimiter(t.role);
        return limiter(() => executeTask(t, input, controller.signal));
      }));
      for (const t of wave) done.add(t.id);
    }
    db.completeRun(input.runId);
  } finally {
    activeRuns.delete(input.runId);
  }
}
function envDefaultSecondsForRole(role) {
  const key = `AGENT_DEFAULT_BUDGET_SECONDS_${role.toUpperCase()}`;
  const raw = process.env[key];
  if (!raw) return void 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : void 0;
}
function defaultSecondsForRole(role) {
  const envVal = envDefaultSecondsForRole(role);
  if (envVal != null) return envVal;
  const map = {
    research: 90,
    fileops: 15,
    shell: 30,
    reviewer: 25,
    summarizer: 15
  };
  return map[role];
}
function createBudgetAbortController(task, runId, parentSignal) {
  var _a;
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parentSignal.addEventListener("abort", onParentAbort);
  let timer = null;
  const explicit = (_a = task == null ? void 0 : task.budgets) == null ? void 0 : _a.seconds;
  const seconds = Number(explicit ?? defaultSecondsForRole(task == null ? void 0 : task.role) ?? 0);
  if (seconds > 0 && Number.isFinite(seconds) && seconds > 0) {
    const ms = Math.max(1, Math.floor(seconds * 1e3));
    timer = setTimeout(() => {
      try {
        db.addRunEvent(runId, { type: "task_timeout", taskId: task.id, seconds });
      } catch {
      }
      controller.abort();
    }, ms);
  }
  const dispose = () => {
    parentSignal.removeEventListener("abort", onParentAbort);
    if (timer) {
      clearTimeout(timer);
    }
  };
  return { signal: controller.signal, dispose };
}
async function executeTask(task, ctx, signal) {
  const { runId, sessionId } = ctx;
  db.updateTaskStatus(runId, task.id, "running", { title: task.title, role: task.role });
  db.addRunEvent(runId, { type: "task_start", taskId: task.id, title: task.title, role: task.role });
  try {
    const { signal: taskSignal, dispose } = createBudgetAbortController(task, runId, signal);
    try {
      let result;
      switch (task.role) {
        case "research":
          result = await spawnResearchAgent({ runId, sessionId, task, query: ctx.prompt, deep: ctx.deep, signal: taskSignal });
          break;
        case "fileops":
          result = await spawnFileOpsAgent({ runId, sessionId, task, automation: ctx.automation, signal: taskSignal });
          break;
        case "shell":
          result = await spawnShellAgent({ runId, sessionId, task, automation: ctx.automation, signal: taskSignal });
          break;
        case "reviewer":
          try {
            const researchResults = db.getTaskResultsByRole(runId, "research");
            const urlSeen = /* @__PURE__ */ new Set();
            const targets = [];
            for (const r of researchResults) {
              for (const t of (r == null ? void 0 : r.targets) ?? []) {
                if ((t == null ? void 0 : t.url) && !urlSeen.has(t.url)) {
                  urlSeen.add(t.url);
                  targets.push({ title: t.title, url: t.url });
                }
              }
            }
            const limitedTargets = targets.slice(0, 12);
            const corpusParts = [];
            for (const r of researchResults) {
              const pth = r == null ? void 0 : r.aggregatePath;
              try {
                if (pth && import_node_fs7.default.existsSync(pth)) {
                  corpusParts.push(import_node_fs7.default.readFileSync(pth, "utf8"));
                }
              } catch {
              }
            }
            let aggregatePath = void 0;
            if (corpusParts.length > 0) {
              const baseDir = import_node_path6.default.join(import_node_os7.default.homedir(), ".local-agent");
              if (!import_node_fs7.default.existsSync(baseDir)) import_node_fs7.default.mkdirSync(baseDir, { recursive: true });
              aggregatePath = import_node_path6.default.join(baseDir, `research-aggregate-merged-${Date.now()}.txt`);
              try {
                import_node_fs7.default.writeFileSync(aggregatePath, corpusParts.join("\n\n---\n\n"), "utf8");
              } catch {
              }
            }
            const graph = buildResearchGraph();
            const stateIn = {
              prompt: ctx.prompt,
              deep: Boolean(ctx.deep),
              targets: limitedTargets,
              aggregatePath,
              synthesis: void 0,
              snippets: [],
              selected: []
            };
            const out = await graph.invoke(stateIn);
            const summary = out.synthesis ?? "No synthesis produced.";
            db.addRunEvent(runId, { type: "review_note", taskId: task.id, summary });
            result = { summary };
          } catch (err) {
            result = { summary: "Synthesis failed." };
          }
          break;
        default:
          result = { skipped: true };
      }
      db.updateTaskStatus(runId, task.id, "done", { title: task.title, role: task.role });
      db.addRunEvent(runId, { type: "task_result", taskId: task.id, taskRole: task.role, result });
    } finally {
      try {
        dispose();
      } catch {
      }
    }
  } catch (err) {
    db.updateTaskStatus(runId, task.id, "failed", { title: task.title, role: task.role });
    db.addRunEvent(runId, { type: "error", taskId: task.id, message: String((err == null ? void 0 : err.message) ?? err) });
  }
}
function cancelRun(runId) {
  const controller = activeRuns.get(runId);
  if (controller) {
    controller.abort();
    activeRuns.delete(runId);
    try {
      db.addRunEvent(runId, { type: "run_cancelled" });
    } catch {
    }
  }
}

// src/agent/registry.ts
init_cjs_shims();
var import_node_path7 = __toESM(require("path"), 1);
var import_node_fs8 = __toESM(require("fs"), 1);
var import_zod2 = require("zod");
init_db();
var registry = /* @__PURE__ */ new Map();
var pluginIds = /* @__PURE__ */ new Set();
function registerWorker(role, id, runner, source = "builtin", lifecycle) {
  registry.set(role, { id, role, runner, source, lifecycle });
}
var Capability = import_zod2.z.object({ role: import_zod2.z.string() });
var ManifestSchema = import_zod2.z.object({
  id: import_zod2.z.string(),
  version: import_zod2.z.string(),
  entrypoint: import_zod2.z.string(),
  // module that default-exports a runner(ctx)
  capabilities: import_zod2.z.array(Capability).default([]),
  permissions: import_zod2.z.array(import_zod2.z.string()).default([])
});
async function loadPlugins(pluginsDir) {
  const root = pluginsDir ?? import_node_path7.default.join(process.cwd(), "src", "plugins");
  if (!import_node_fs8.default.existsSync(root)) return { loaded: 0 };
  const files = import_node_fs8.default.readdirSync(root);
  let loaded = 0;
  for (const [role, reg] of Array.from(registry.entries())) {
    if (reg.source === "plugin") registry.delete(role);
  }
  pluginIds.clear();
  for (const name of files) {
    try {
      const dir = import_node_path7.default.join(root, name);
      const manifestPath = import_node_path7.default.join(dir, "manifest.json");
      if (!import_node_fs8.default.existsSync(manifestPath)) continue;
      const raw = JSON.parse(import_node_fs8.default.readFileSync(manifestPath, "utf8"));
      const manifest = ManifestSchema.parse(raw);
      const modPath = import_node_path7.default.isAbsolute(manifest.entrypoint) ? manifest.entrypoint : import_node_path7.default.join(dir, manifest.entrypoint);
      const mod = await import(pathToFileUrlSafe(modPath));
      const runner = typeof mod.default === "function" ? mod.default : mod.runner;
      const lifecycle = mod.lifecycle;
      if (typeof runner !== "function") throw new Error(`Invalid plugin runner in ${manifest.id}`);
      for (const cap of manifest.capabilities) {
        registerWorker(cap.role, manifest.id, runner, "plugin", lifecycle);
      }
      pluginIds.add(manifest.id);
      loaded++;
      db.addRunEvent("system", { type: "plugin_loaded", id: manifest.id, version: manifest.version, roles: manifest.capabilities.map((c) => c.role) });
    } catch (e) {
      db.addRunEvent("system", { type: "plugin_error", message: String((e == null ? void 0 : e.message) ?? e) });
    }
  }
  return { loaded };
}
function pathToFileUrlSafe(p) {
  if (p.startsWith("file://")) return p;
  return pathToFileUrl(p);
}
function pathToFileUrl(p) {
  const { pathToFileURL } = require("url");
  return pathToFileURL(p).href;
}
function registerBuiltInWorkers() {
  try {
    const { spawnFileOpsAgent: spawnFileOpsAgent2 } = (init_fileops(), __toCommonJS(fileops_exports));
    registerWorker("fileops", "builtin-fileops", (ctx) => spawnFileOpsAgent2(ctx));
  } catch {
  }
  try {
    const { spawnResearchAgent: spawnResearchAgent2 } = (init_research(), __toCommonJS(research_exports));
    registerWorker("research", "builtin-research", (ctx) => spawnResearchAgent2({ ...ctx, query: ctx.task.description, deep: false }));
  } catch {
  }
  try {
    const { spawnShellAgent: spawnShellAgent2 } = (init_shell(), __toCommonJS(shell_exports));
    registerWorker("shell", "builtin-shell", (ctx) => spawnShellAgent2({ ...ctx, automation: true }));
  } catch {
  }
}
function watchPlugins(pluginsDir) {
  const root = pluginsDir ?? import_node_path7.default.join(process.cwd(), "src", "plugins");
  if (!import_node_fs8.default.existsSync(root)) return;
  let timer = null;
  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void loadPlugins(root);
    }, 250);
  };
  try {
    import_node_fs8.default.watch(root, { recursive: true }, trigger);
    db.addRunEvent("system", { type: "plugin_watch", message: `Watching ${root}` });
  } catch (e) {
    db.addRunEvent("system", { type: "plugin_watch_error", message: String((e == null ? void 0 : e.message) ?? e) });
  }
}

// src/agent/runtime.ts
init_event_bus();
init_confirm();

// src/agent/config.ts
init_cjs_shims();
var import_node_fs9 = __toESM(require("fs"), 1);
var import_node_path8 = __toESM(require("path"), 1);
var import_node_os8 = __toESM(require("os"), 1);
var overrideDir = process.env.LOCAL_AGENT_CONFIG_DIR;
var CONFIG_DIR = overrideDir ? import_node_path8.default.resolve(overrideDir) : import_node_path8.default.join(import_node_os8.default.homedir(), ".local-agent");
var CONFIG_PATH = import_node_path8.default.join(CONFIG_DIR, "config.json");
function readConfig() {
  try {
    if (import_node_fs9.default.existsSync(CONFIG_PATH)) {
      return JSON.parse(import_node_fs9.default.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch {
  }
  return {};
}
function writeConfig(cfg) {
  try {
    if (!import_node_fs9.default.existsSync(CONFIG_DIR)) import_node_fs9.default.mkdirSync(CONFIG_DIR, { recursive: true });
    import_node_fs9.default.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
  } catch {
  }
}
function getDefaultModel() {
  return readConfig().defaultModel;
}
function setDefaultModel(model) {
  const cfg = readConfig();
  cfg.defaultModel = model;
  writeConfig(cfg);
}
function getRetentionDays() {
  const d = readConfig().retentionDays;
  return typeof d === "number" && d > 0 ? d : 14;
}
function getVisualizerVariant() {
  return readConfig().visualizerVariant || "halo";
}
function setVisualizerVariant(variant) {
  const cfg = readConfig();
  cfg.visualizerVariant = variant;
  writeConfig(cfg);
}

// src/agent/runtime.ts
init_db();

// src/agent/web.ts
init_cjs_shims();
async function getFetch() {
  const g = globalThis;
  if (typeof g.fetch === "function") return g.fetch.bind(globalThis);
  return (input, init) => globalThis.fetch(input, init);
}
function htmlToText(html) {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, "");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return t.replace(/\s+/g, " ").trim();
}
async function quickSearch(query, count = 3) {
  try {
    const tavily = process.env.TAVILY_API_KEY;
    const doFetch = await getFetch();
    if (tavily) {
      const resp2 = await doFetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tavily}` },
        body: JSON.stringify({ query, include_answer: false, max_results: Math.max(1, Math.min(5, count)), search_depth: "basic", auto_parameters: true })
      });
      if (resp2.ok) {
        const data = await resp2.json();
        const results2 = Array.isArray(data == null ? void 0 : data.results) ? data.results : [];
        return results2.slice(0, count).map((r) => ({ title: ((r == null ? void 0 : r.title) ?? "").toString() || (r == null ? void 0 : r.url) || "Result", url: ((r == null ? void 0 : r.url) ?? "").toString(), snippet: ((r == null ? void 0 : r.content) ?? "").toString().slice(0, 200) }));
      }
    }
    const url = "https://duckduckgo.com/html/?kz=1&q=" + encodeURIComponent(query);
    const proxied = "https://r.jina.ai/http/" + url;
    const resp = await doFetch(proxied);
    const html = await resp.text();
    const results = [];
    const re = /<a[^>]+class="result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gim;
    let m;
    while ((m = re.exec(html)) && results.length < count) {
      let href = m[1];
      let title = htmlToText(m[2]);
      try {
        const u = new URL(href);
        const uddg = u.searchParams.get("uddg");
        if (uddg) href = decodeURIComponent(uddg);
      } catch {
      }
      if (!title) title = href;
      results.push({ title, url: href });
    }
    return results;
  } catch {
    return [];
  }
}
async function fetchReadable(url, maxChars = 6e3) {
  try {
    const doFetch = await getFetch();
    const proxy = "https://r.jina.ai/http/" + encodeURIComponent(url);
    const resp = await doFetch(proxy, { redirect: "follow" });
    if (!resp.ok) return "";
    const text = await resp.text();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}

// src/agent/runtime.ts
var LMClient = class {
  baseURL;
  constructor(baseURL) {
    this.baseURL = baseURL;
  }
  async listModels() {
    const r = await fetch(this.baseURL.replace(/\/$/, "") + "/models");
    const j = await r.json();
    return Array.isArray(j == null ? void 0 : j.data) ? j.data.map((m) => m.id) : [];
  }
  async chat(messages, model, opts) {
    var _a, _b, _c, _d;
    const body = {
      model,
      messages,
      temperature: (opts == null ? void 0 : opts.temperature) ?? 0.7,
      stream: Boolean(opts == null ? void 0 : opts.stream)
    };
    if ((opts == null ? void 0 : opts.reasoningEffort) && process.env.LM_DISABLE_REASONING !== "1") {
      body.reasoning_effort = opts.reasoningEffort;
      console.log(`[LMClient] Sending reasoning effort: ${opts.reasoningEffort}`);
      console.log(`[LMClient] Direct to LM Studio - no proxy`);
    }
    if (typeof (opts == null ? void 0 : opts.maxTokens) === "number") body.max_tokens = opts.maxTokens;
    if (typeof (opts == null ? void 0 : opts.topP) === "number") body.top_p = opts.topP;
    if (typeof (opts == null ? void 0 : opts.presencePenalty) === "number") body.presence_penalty = opts.presencePenalty;
    if (typeof (opts == null ? void 0 : opts.frequencyPenalty) === "number") body.frequency_penalty = opts.frequencyPenalty;
    if (opts == null ? void 0 : opts.reasoningEffort) {
      console.log(`[LMClient] Full request body with reasoning effort:`, JSON.stringify(body, null, 2));
    }
    const r = await fetch(this.baseURL.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...process.env.LMSTUDIO_AUTH ? { "Authorization": process.env.LMSTUDIO_AUTH } : {}
      },
      body: JSON.stringify(body)
    });
    if (opts == null ? void 0 : opts.reasoningEffort) {
      console.log(`[LMClient] Response status:`, r.status);
      console.log(`[LMClient] Response is streaming:`, opts.stream);
      if (!opts.stream && r.ok) {
        try {
          const responseClone = r.clone();
          const responseData = await responseClone.json();
          console.log(`[LMClient] Response reasoning_content length:`, ((_d = (_c = (_b = (_a = responseData == null ? void 0 : responseData.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.reasoning_content) == null ? void 0 : _d.length) || 0);
        } catch (e) {
          console.log(`[LMClient] Could not parse response as JSON (this is normal for streaming)`);
        }
      }
    }
    return r;
  }
};
function createAgentRuntime(ipcMain2) {
  async function getElevenLabsKey() {
    try {
      if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim().length > 0) {
        return process.env.ELEVENLABS_API_KEY.trim();
      }
    } catch {
    }
    try {
      const { readFileSync, existsSync } = await import("fs");
      const { join } = await import("path");
      const roots = [process.cwd(), join(process.cwd(), ".."), join(process.cwd(), "resources")];
      for (const r of roots) {
        const p = join(r, "keys.md");
        if (existsSync(p)) {
          const t = readFileSync(p, "utf8");
          const m = t.match(/eleven\s*labs\s*key\s*:\s*([a-zA-Z0-9_\-]+)\b/i);
          if (m && m[1]) return m[1].trim();
        }
      }
    } catch {
    }
    return null;
  }
  try {
    registerBuiltInWorkers();
  } catch {
  }
  try {
    void loadPlugins();
  } catch {
  }
  try {
    watchPlugins();
  } catch {
  }
  try {
    const runPrune = () => db.pruneOldData(getRetentionDays());
    setInterval(runPrune, 24 * 60 * 60 * 1e3);
  } catch {
  }
  ipcMain2.handle("agent/startTask", async (_event, input) => {
    const sessionId = db.createSession(input.prompt);
    const runId = db.createRun(sessionId);
    const chosenModel = input.model ?? getDefaultModel() ?? process.env.LMSTUDIO_MODEL ?? process.env.OLLAMA_MODEL ?? "local-model";
    db.addRunEvent(runId, { type: "run_started", prompt: input.prompt, model: chosenModel, deep: Boolean(input.deep), dryRun: Boolean(input.dryRun), automation: Boolean(input.automation) });
    startOrchestrator({ sessionId, runId, prompt: input.prompt, model: chosenModel, deep: Boolean(input.deep), dryRun: Boolean(input.dryRun), automation: Boolean(input.automation) });
    return { runId };
  });
  ipcMain2.handle("agent/getHistory", async (_event, input) => {
    return db.getHistory(input.sessionId);
  });
  ipcMain2.handle("agent/confirmDangerous", async (_event, input) => {
    resolveConfirmation(input.runId, input.taskId, input.confirm);
  });
  ipcMain2.handle("agent/setDefaultModel", async (_event, input) => {
    setDefaultModel(input.model);
  });
  ipcMain2.handle("agent/getDefaultModel", async () => {
    try {
      return { model: getDefaultModel() };
    } catch {
      return { model: void 0 };
    }
  });
  ipcMain2.handle("agent/listModels", async () => {
    const results = /* @__PURE__ */ new Set();
    try {
      const baseURL = process.env.LM_GATEWAY_URL ?? process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
      const r = await fetch(baseURL.replace(/\/$/, "") + "/models");
      if (r.ok) {
        const j = await r.json();
        const names = Array.isArray(j == null ? void 0 : j.data) ? j.data.map((m) => String(m.id)) : [];
        for (const n of names) results.add(n);
      }
    } catch {
    }
    try {
      const ollama = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
      const r = await fetch(ollama + "/api/tags");
      if (r.ok) {
        const j = await r.json();
        const arr = Array.isArray(j == null ? void 0 : j.models) ? j.models : [];
        for (const m of arr) {
          const name = String((m == null ? void 0 : m.model) || (m == null ? void 0 : m.name) || "");
          if (name) results.add("ollama:" + name);
        }
      }
    } catch {
    }
    return Array.from(results);
  });
  ipcMain2.handle("agent/getVisualizerVariant", async () => {
    return { variant: getVisualizerVariant() };
  });
  ipcMain2.handle("agent/setVisualizerVariant", async (_event, input) => {
    setVisualizerVariant(input.variant);
  });
  ipcMain2.handle("agent/cancelRun", async (_event, input) => {
    try {
      cancelRun(input.runId);
      db.addRunEvent(input.runId, { type: "run_cancelled" });
    } catch {
    }
  });
  ipcMain2.handle("agent/openPath", async (_event, input) => {
    try {
      await import_electron.shell.openPath(input.path);
    } catch {
    }
  });
  ipcMain2.handle("agent/revealInFolder", async (_event, input) => {
    try {
      import_electron.shell.showItemInFolder(input.path);
    } catch {
    }
  });
  ipcMain2.handle("agent/readFileText", async (_event, input) => {
    try {
      const fs10 = await import("fs");
      const content = fs10.readFileSync(input.path, "utf8");
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain2.handle("agent/voiceTTS", async (_event, input) => {
    try {
      const key = await getElevenLabsKey();
      if (!key) {
        return { success: false, error: 'Missing ELEVENLABS_API_KEY (or keys.md entry: "eleven labs key:")' };
      }
      const voiceId = (input.voiceId || "21m00Tcm4TlvDq8ikWAM").trim();
      const modelId = (input.modelId || "eleven_multilingual_v2").trim();
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({ text: input.text || "", model_id: modelId })
      });
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        return { success: false, error: `TTS error ${r.status}: ${msg.slice(0, 200)}` };
      }
      const buf = Buffer.from(await r.arrayBuffer());
      const b64 = buf.toString("base64");
      return { success: true, audioBase64: b64, format: "mp3" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain2.handle("agent/elevenVoices", async () => {
    try {
      const key = await getElevenLabsKey();
      if (!key) return { success: false, error: "Missing ELEVENLABS_API_KEY or keys.md" };
      const r = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": key }
      });
      if (!r.ok) return { success: false, error: `HTTP ${r.status}` };
      const j = await r.json();
      const voices = Array.isArray(j == null ? void 0 : j.voices) ? j.voices.map((v) => ({ id: v.voice_id || v.voiceID || v.id, name: v.name || "Voice", category: v.category || "", labels: v.labels || {} })) : [];
      return { success: true, voices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain2.handle("agent/speechToText", async (_event, input) => {
    try {
      const getLocalWhisperUrl = async () => {
        if (process.env.WHISPER_HTTP_URL && process.env.WHISPER_HTTP_URL.trim()) return process.env.WHISPER_HTTP_URL.trim();
        try {
          const { readFileSync, existsSync } = await import("fs");
          const { join } = await import("path");
          const roots = [process.cwd(), join(process.cwd(), ".."), join(process.cwd(), "resources")];
          for (const r2 of roots) {
            const p = join(r2, "keys.md");
            if (existsSync(p)) {
              const t = readFileSync(p, "utf8");
              const m = t.match(/whisper\s*url\s*:\s*(https?:[^\s]+)\b/i);
              if (m && m[1]) return m[1].trim();
            }
          }
        } catch {
        }
        return null;
      };
      const mime = (input.mimeType || "audio/webm").trim();
      const fileName = (input.fileName || `speech.${mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav" : mime.includes("m4a") ? "m4a" : "webm"}`).trim();
      const binary = Buffer.from(input.audioBase64, "base64");
      const form = new FormData();
      const blob = new Blob([binary], { type: mime });
      form.append("file", blob, fileName);
      form.append("model", "whisper-1");
      const localUrl = await getLocalWhisperUrl();
      if (localUrl) {
        const r2 = await fetch(localUrl, { method: "POST", body: form });
        if (!r2.ok) {
          const msg = await r2.text().catch(() => "");
          return { success: false, error: `Local STT error ${r2.status}: ${msg.slice(0, 200)}` };
        }
        const j2 = await r2.json();
        const txt = typeof (j2 == null ? void 0 : j2.text) === "string" ? j2.text : typeof (j2 == null ? void 0 : j2.transcription) === "string" ? j2.transcription : "";
        return { success: true, text: txt };
      }
      const getKey = async () => {
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) return process.env.OPENAI_API_KEY.trim();
        try {
          const { readFileSync, existsSync } = await import("fs");
          const { join } = await import("path");
          const roots = [process.cwd(), join(process.cwd(), ".."), join(process.cwd(), "resources")];
          for (const r2 of roots) {
            const p = join(r2, "keys.md");
            if (existsSync(p)) {
              const t = readFileSync(p, "utf8");
              const m = t.match(/openai\s*key\s*:\s*([a-zA-Z0-9_\-]+)\b/i);
              if (m && m[1]) return m[1].trim();
            }
          }
        } catch {
        }
        return null;
      };
      const key = await getKey();
      if (!key) return { success: false, error: 'Missing OPENAI_API_KEY (or keys.md entry: "openai key:") and no WHISPER_HTTP_URL configured' };
      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { "Authorization": `Bearer ${key}` }, body: form });
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        return { success: false, error: `STT error ${r.status}: ${msg.slice(0, 200)}` };
      }
      const j = await r.json();
      const text = (j == null ? void 0 : j.text) || "";
      return { success: true, text };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain2.handle("agent/saveUploadedImage", async (_event, input) => {
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const { writeFile } = await import("fs/promises");
    try {
      const matches = input.dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) {
        throw new Error("Invalid data URL format");
      }
      const extension = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      const timestamp = Date.now();
      const tempFilePath = join(tmpdir(), `uploaded-image-${timestamp}.${extension}`);
      await writeFile(tempFilePath, buffer);
      return { success: true, filePath: tempFilePath };
    } catch (error) {
      console.error("Failed to save uploaded image:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain2.handle("agent/simpleChat", async (_event, input) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const searchEnabled = input.searchEnabled !== false;
    const showThinking = input.showThinking !== false;
    try {
      const baseURL = process.env.LM_GATEWAY_URL ?? process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
      const client = new LMClient(baseURL);
      let modelName = input.model ?? "gpt-oss:20b";
      if (!input.model) {
        try {
          const models = await client.listModels();
          modelName = models.find((m) => m.includes("openai/gpt-oss")) ?? models.find((m) => m.includes("gpt-oss")) ?? models.find((m) => m.includes("custom-test")) ?? models[0] ?? "gpt-oss:20b";
        } catch {
          modelName = "gpt-oss:20b";
        }
      }
      const chatGuard = [
        'You are Local Agent in Chat mode. You may use the provided "Web context (short)" if present, but you do not browse live.',
        "Never output tool-call markup or channel tags. Cite web sources using Markdown links when you rely on the web context.",
        "If the API supports it, place your chain-of-thought in reasoning_content and put only the final answer in content.",
        "If reasoning_content is not supported, stream your chain-of-thought inside <think>...</think> and put the final answer outside the think block. Do not use any other custom tags."
      ].join(" ");
      const userText = ((_a = input.messages.slice().reverse().find((m) => m.role === "user")) == null ? void 0 : _a.content) ?? "";
      const quickRegex = /\b(search|look up|find|news|latest|open\s+url|go to)\b/i;
      const urlMatchHeuristic = /https?:\/\/\S+/i.test(userText);
      const wantsQuick = searchEnabled && (quickRegex.test(userText) || urlMatchHeuristic);
      let quickContext;
      let quickHits;
      if (wantsQuick) {
        try {
          const urlMatch = userText.match(/https?:\/\/\S+/);
          if (urlMatch) {
            const readable = await fetchReadable(urlMatch[0]);
            if (readable) quickContext = `Source ${urlMatch[0]}

${readable}`;
            quickHits = [{ title: urlMatch[0], url: urlMatch[0] }];
          } else {
            const q = userText.replace(/^\s*(?:please\s*)?(?:search|look up|find|check)\s*/i, "").trim();
            const hits = await quickSearch(q, 3);
            if (hits.length > 0) {
              const top = hits[0];
              const readable = await fetchReadable(top.url);
              const list = hits.map((h, i) => `${i + 1}. ${h.title} - ${h.url}`).join("\n");
              quickContext = `Top results for: ${q}
${list}

Primary source: ${top.url}

${readable}`;
              quickHits = hits;
            }
          }
        } catch {
        }
      }
      const guardedMessages = [
        { role: "system", content: chatGuard },
        ...quickContext ? [{ role: "system", content: `Web context (short):
${quickContext}` }] : [],
        ...input.messages
      ];
      const rl = input.reasoningLevel ?? "medium";
      const effortToTemp = rl === "high" ? 0.2 : rl === "low" ? 0.8 : 0.6;
      const effortToTopP = rl === "high" ? 0.4 : rl === "low" ? 0.95 : 0.8;
      const effortToPresence = rl === "high" ? -0.2 : rl === "low" ? 0.4 : 0.1;
      const effortToFreq = rl === "high" ? -0.2 : rl === "low" ? 0.4 : 0.1;
      const reasoningHint = `reasoning: ${rl}
Reasoning Effort: ${rl}`;
      const systemIdx = guardedMessages.findIndex((m) => m.role === "system");
      if (systemIdx >= 0) guardedMessages[systemIdx] = { role: "system", content: guardedMessages[systemIdx].content + `
${reasoningHint}` };
      const doStream = input.stream !== false && process.env.LM_DISABLE_STREAM !== "1" && process.env.LM_FORCE_NON_STREAM !== "1";
      if (typeof modelName === "string" && modelName.startsWith("ollama:")) {
        try {
          const base = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
          const userMax = typeof input.maxTokens === "number" ? input.maxTokens : void 0;
          const userTopP = typeof input.topP === "number" ? input.topP : void 0;
          const resp = await fetch(base + "/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelName.replace(/^ollama:/, ""),
              messages: guardedMessages.map((m) => ({ role: m.role, content: m.content })),
              stream: doStream,
              think: showThinking,
              options: {
                temperature: input.temperature ?? effortToTemp,
                top_p: userTopP ?? effortToTopP,
                presence_penalty: effortToPresence,
                frequency_penalty: effortToFreq,
                num_predict: userMax ?? 512
              }
            })
          });
          if (!resp.ok) {
            const msg = await resp.text().catch(() => "");
            return { success: false, error: `Ollama HTTP ${resp.status}: ${msg.slice(0, 200)}`, content: "" };
          }
          if (doStream && resp.body) {
            const reader = resp.body.getReader ? resp.body.getReader() : null;
            let raw = "";
            let rawThinking = "";
            let buffer = "";
            const decoder = new TextDecoder();
            async function flush() {
              let thinkingOut = rawThinking;
              let answerOut = raw;
              try {
                if (!thinkingOut) {
                  const thinkMatch = answerOut.match(/<think>([\s\S]*?)<\/think>/i);
                  if (thinkMatch == null ? void 0 : thinkMatch[1]) {
                    thinkingOut = (thinkingOut + thinkMatch[1]).trim();
                    answerOut = answerOut.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
                  }
                }
              } catch {
              }
              if (showThinking && input.thinkingId) {
                eventBus.emit("event", { type: "stream_thinking", id: input.thinkingId, content: thinkingOut });
              }
              if (input.answerId) {
                eventBus.emit("event", { type: "stream_answer", id: input.answerId, content: answerOut });
              }
            }
            if (reader) {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const text = decoder.decode(value, { stream: true });
                buffer += text;
                const lines = buffer.split(/\n/);
                buffer = lines.pop() || "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  try {
                    const obj = JSON.parse(trimmed);
                    const piece = String(((_b = obj == null ? void 0 : obj.message) == null ? void 0 : _b.content) || "");
                    const thinkPiece = String(((_c = obj == null ? void 0 : obj.message) == null ? void 0 : _c.thinking) ?? (obj == null ? void 0 : obj.thinking) ?? "");
                    if (piece) raw += piece;
                    if (thinkPiece) rawThinking += thinkPiece;
                    await flush();
                  } catch {
                  }
                }
              }
              await flush();
              let finalThinking = rawThinking;
              let finalAnswer = raw;
              try {
                if (!finalThinking) {
                  const finalThinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
                  finalThinking = ((_d = finalThinkMatch == null ? void 0 : finalThinkMatch[1]) == null ? void 0 : _d.trim()) || "";
                  finalAnswer = raw.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
                }
              } catch {
              }
              return { success: true, content: finalAnswer, model: modelName, links: quickHits == null ? void 0 : quickHits.slice(0, 3), thinking: showThinking ? finalThinking : "" };
            } else {
              const text = await resp.text();
              try {
                const jj = JSON.parse(text);
                raw = String(((_e = jj == null ? void 0 : jj.message) == null ? void 0 : _e.content) || "");
                rawThinking = String(((_f = jj == null ? void 0 : jj.message) == null ? void 0 : _f.thinking) ?? (jj == null ? void 0 : jj.thinking) ?? "");
              } catch {
                raw = text;
              }
              let thinking = rawThinking;
              let answer = raw;
              try {
                if (!thinking) {
                  const m = raw.match(/<think>([\s\S]*?)<\/think>/i);
                  thinking = ((_g = m == null ? void 0 : m[1]) == null ? void 0 : _g.trim()) || "";
                  answer = raw.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
                }
              } catch {
              }
              if (showThinking && input.thinkingId && thinking) eventBus.emit("event", { type: "stream_thinking", id: input.thinkingId, content: thinking });
              return { success: true, content: answer, model: modelName, links: quickHits == null ? void 0 : quickHits.slice(0, 3), thinking: showThinking ? thinking : "" };
            }
          } else {
            const jj = await resp.json();
            let content = String(((_h = jj == null ? void 0 : jj.message) == null ? void 0 : _h.content) || "");
            let thinking = String(((_i = jj == null ? void 0 : jj.message) == null ? void 0 : _i.thinking) ?? (jj == null ? void 0 : jj.thinking) ?? "");
            try {
              if (!thinking) {
                const m = content.match(/<think>([\s\S]*?)<\/think>/i);
                if (m && m[1]) {
                  thinking = m[1].trim();
                  content = content.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
                }
              }
            } catch {
            }
            if (showThinking && input.thinkingId && thinking) {
              eventBus.emit("event", { type: "stream_thinking", id: input.thinkingId, content: thinking });
            }
            return { success: true, content, model: modelName, links: quickHits == null ? void 0 : quickHits.slice(0, 3), thinking: showThinking ? thinking : "" };
          }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Ollama error", content: "" };
        }
      }
      if (doStream) {
        const resp = await client.chat(guardedMessages, modelName, {
          temperature: input.temperature ?? effortToTemp,
          topP: effortToTopP,
          presencePenalty: effortToPresence,
          frequencyPenalty: effortToFreq,
          stream: true,
          reasoningEffort: rl,
          maxTokens: typeof input.maxTokens === "number" ? input.maxTokens : 512
        });
        let answer = "";
        let thinking = "";
        let rawAllContent = "";
        const body = resp.body;
        const decoder = new TextDecoder();
        let buffer = "";
        async function handleText(text) {
          var _a2, _b2;
          buffer += text;
          const events = buffer.split(/\n\n/);
          buffer = events.pop() || "";
          for (const evt of events) {
            const dataLines = evt.split(/\n/).filter((l) => l.startsWith("data:"));
            const payload = dataLines.map((l) => l.replace(/^data:\s*/, "")).join("\n").trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const delta = JSON.parse(payload);
              const piece = ((_b2 = (_a2 = delta == null ? void 0 : delta.choices) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.delta) || {};
              if (typeof (piece == null ? void 0 : piece.reasoning_content) === "string") {
                thinking += piece.reasoning_content;
              }
              if (typeof (piece == null ? void 0 : piece.content) === "string") {
                rawAllContent += piece.content;
              }
              let derivedThinking = "";
              let derivedAnswer = rawAllContent;
              try {
                const closedSegments = derivedAnswer.match(/<think>[\s\S]*?<\/think>/g) || [];
                derivedThinking = closedSegments.map((s) => s.replace(/^<think>/i, "").replace(/<\/think>$/i, "").slice(0)).join("");
                const lastOpen = derivedAnswer.lastIndexOf("<think>");
                const lastClose = derivedAnswer.lastIndexOf("</think>");
                if (lastOpen > -1 && lastOpen > lastClose) {
                  derivedThinking += derivedAnswer.slice(lastOpen + 7);
                }
                derivedAnswer = derivedAnswer.replace(/<think>[\s\S]*?<\/think>/g, "");
                if (lastOpen > -1 && lastOpen > lastClose) {
                  derivedAnswer = derivedAnswer.slice(0, lastOpen);
                }
              } catch {
              }
              const combinedThinking = (thinking + derivedThinking).trim();
              if (showThinking && input.thinkingId) {
                eventBus.emit("event", { type: "stream_thinking", id: input.thinkingId, content: combinedThinking });
              }
              answer = derivedAnswer;
              if (input.answerId) {
                eventBus.emit("event", { type: "stream_answer", id: input.answerId, content: answer });
              }
            } catch {
            }
          }
        }
        if (body == null ? void 0 : body.getReader) {
          const reader = body.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            await handleText(decoder.decode(value, { stream: true }));
          }
        } else if (body) {
          try {
            for await (const chunk of body) {
              await handleText(decoder.decode(chunk, { stream: true }));
            }
          } catch (e) {
            console.log(`[LMClient] Async iteration failed, trying text fallback:`, e);
            try {
              const text = await resp.text();
              await handleText(text);
            } catch (textError) {
              console.log(`[LMClient] Text fallback also failed:`, textError);
              throw textError;
            }
          }
        }
        return { success: true, content: answer.trim(), model: modelName, links: quickHits == null ? void 0 : quickHits.slice(0, 3), thinking: showThinking ? thinking : "" };
      } else {
        const resp = await client.chat(
          guardedMessages,
          modelName,
          {
            temperature: input.temperature ?? effortToTemp,
            topP: effortToTopP,
            presencePenalty: effortToPresence,
            frequencyPenalty: effortToFreq,
            stream: false,
            reasoningEffort: rl,
            maxTokens: typeof input.maxTokens === "number" ? input.maxTokens : 512
          }
        );
        const jj = await resp.json();
        const contentAll = ((_l = (_k = (_j = jj == null ? void 0 : jj.choices) == null ? void 0 : _j[0]) == null ? void 0 : _k.message) == null ? void 0 : _l.content) ?? "";
        const reasoningSeparated = ((_o = (_n = (_m = jj == null ? void 0 : jj.choices) == null ? void 0 : _m[0]) == null ? void 0 : _n.message) == null ? void 0 : _o.reasoning_content) || "";
        const extract = (() => {
          try {
            const tagFinal = contentAll.match(/<final>([\s\S]*?)<\/final>/i);
            if (tagFinal == null ? void 0 : tagFinal[1]) return { content: tagFinal[1].trim(), thinking: contentAll.replace(/<final>[\s\S]*$/i, "").trim() };
          } catch {
          }
          return { content: contentAll.trim(), thinking: "" };
        })();
        let cleaned = extract.content;
        cleaned = cleaned.replace(/<\|[^>]+\|>/g, "");
        cleaned = cleaned.replace(/^\s*commentary\s+to=[^\n]*$/gim, "");
        cleaned = cleaned.replace(/^\s*code\s*\{[\s\S]*$/gim, "");
        return {
          success: true,
          content: cleaned,
          model: modelName,
          links: quickHits == null ? void 0 : quickHits.slice(0, 3),
          thinking: showThinking ? reasoningSeparated || extract.thinking : ""
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      const baseURL = process.env.LM_GATEWAY_URL ?? process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
      let userFriendlyMessage = `Sorry, I encountered an error connecting to LM Studio at ${baseURL}.`;
      if (errorMessage.includes("fetch")) {
        userFriendlyMessage += " Please make sure LM Studio is running and the local server is started.";
      } else if (errorMessage.includes("json_object")) {
        userFriendlyMessage += " There was an API compatibility issue that should now be fixed.";
      } else if (errorMessage.includes("response_format")) {
        userFriendlyMessage += " There was an API format issue that should now be fixed.";
      } else if (errorMessage.includes("ECONNREFUSED")) {
        userFriendlyMessage += " Connection refused - please start LM Studio and enable the local server.";
      } else {
        userFriendlyMessage += ` Error details: ${errorMessage}`;
      }
      return {
        success: false,
        error: errorMessage,
        content: userFriendlyMessage
      };
    }
  });
}

// electron/main.ts
init_logger();

// src/agent/ipc_bridge.ts
init_cjs_shims();
init_event_bus();
function setupEventForwarding(win) {
  const handler = (payload) => {
    win.webContents.send("agent/event", payload);
  };
  eventBus.on("event", handler);
  return () => eventBus.off("event", handler);
}

// electron/main.ts
var import_config2 = require("dotenv/config");
var __filename2 = (0, import_node_url.fileURLToPath)(importMetaUrl);
var __dirname = import_node_path9.default.dirname(__filename2);
var mainWindow = null;
async function createWindow() {
  mainWindow = new import_electron2.BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: import_node_path9.default.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: "Local Agent"
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(import_node_path9.default.join(__dirname, "../dist/index.html"));
  }
  const ok = import_electron2.globalShortcut.register("CommandOrControl+/", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  if (!ok) {
    logger.warn("Failed to register global shortcut Cmd+/");
  }
}
import_electron2.app.whenReady().then(async () => {
  await createWindow();
  if (mainWindow) {
    setupEventForwarding(mainWindow);
  }
  createAgentRuntime(import_electron2.ipcMain);
});
import_electron2.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron2.app.quit();
});
import_electron2.app.on("activate", () => {
  if (import_electron2.BrowserWindow.getAllWindows().length === 0) void createWindow();
});
import_electron2.app.on("will-quit", () => {
  import_electron2.globalShortcut.unregisterAll();
});
