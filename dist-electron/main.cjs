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
  var _a3, _b, _c, _d, _e, _f;
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
    if ((_a3 = ctx.signal) == null ? void 0 : _a3.aborted) {
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
    const limit2 = ctx.deep ? 12 : 5;
    const finalTargets = rankedTargets.slice(0, limit2);
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
              var _a4;
              const article = document.querySelector("article");
              if (article) return article.innerText;
              const main = document.querySelector("main");
              if (main) return main.innerText;
              const sel = document.querySelector('div[id*="content"], div[class*="content"], section[id*="content"], section[class*="content"]');
              if (sel) return sel.innerText;
              return ((_a4 = document.body) == null ? void 0 : _a4.innerText) || "";
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
    var _a3;
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
      (_a3 = ctx == null ? void 0 : ctx.signal) == null ? void 0 : _a3.addEventListener("abort", () => {
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
  var _a3;
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
  const cpuCores = Math.max(2, ((_a3 = import_node_os3.default.cpus()) == null ? void 0 : _a3.length) || 4);
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
  var _a3;
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
        const hasText = !!((_a3 = ocrResult == null ? void 0 : ocrResult.extractedText) == null ? void 0 : _a3.trim());
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
  var _a3, _b, _c;
  try {
    const parsed = JSON.parse(ctx.task.description);
    if ((parsed == null ? void 0 : parsed.op) === "open" && typeof parsed.name === "string") {
      const name = String(parsed.name).toLowerCase();
      const scope = (parsed.scope || "any").toLowerCase();
      const action = parsed.action === "reveal" ? "reveal" : "open";
      const home2 = import_node_os4.default.homedir();
      const scopes = {
        desktop: import_node_path4.default.join(home2, "Desktop"),
        documents: import_node_path4.default.join(home2, "Documents"),
        downloads: import_node_path4.default.join(home2, "Downloads"),
        pictures: import_node_path4.default.join(home2, "Pictures")
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
      const name = String(parsed.name);
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
        if (listType === "folders") {
          const root = scope !== "any" ? scopes[scope] : import_node_os4.default.homedir();
          if (root && import_node_fs4.default.existsSync(root)) {
            const cmd = `find ${JSON.stringify(root)} -maxdepth 1 -type d -not -path '*/\\.*'`;
            out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          }
        } else if (listType === "files") {
          const root = scope !== "any" ? scopes[scope] : import_node_os4.default.homedir();
          if (root && import_node_fs4.default.existsSync(root)) {
            const cmd = `find ${JSON.stringify(root)} -maxdepth 1 -type f -not -path '*/\\.*'`;
            out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          }
        } else {
          const cmd = `mdfind -name ${JSON.stringify(name)}`;
          out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
        }
        const lines = out.split("\n").map((s) => s.trim()).filter(Boolean);
        for (const p of lines) {
          if (scope !== "any") {
            const base = scopes[scope];
            if (base && !p.startsWith(base)) continue;
          }
          candidates.push(p);
          if (candidates.length >= 50) break;
        }
      } catch {
      }
      if (candidates.length === 0) {
        const dirs = scope === "any" ? Object.values(scopes) : [scopes[scope]].filter(Boolean);
        for (const d of dirs) {
          try {
            if ((_a3 = ctx.signal) == null ? void 0 : _a3.aborted) throw new Error("Cancelled");
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
      var _a3;
      if (pending.has(k)) {
        (_a3 = pending.get(k)) == null ? void 0 : _a3(false);
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
  const whitelist = /* @__PURE__ */ new Set(["git", "ls", "cat", "echo", "pwd", "open", "osascript", "killall"]);
  return whitelist.has(first);
}
async function spawnShellAgent(ctx) {
  const parsed = parseCommandFromDescription(ctx.task.description);
  if (!parsed) {
    throw new Error("No shell command provided");
  }
  const cmd = parsed.cmd;
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
  const shellBin = process.env.SHELL || "/bin/zsh";
  const home = import_node_os5.default.homedir();
  return await new Promise((resolve, reject) => {
    const child = (0, import_node_child_process2.spawn)(shellBin, ["-lc", cmd], { cwd: home, env: process.env });
    let out = "";
    let err = "";
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
      if (exitCode === 0 && meta && meta.kind === "slack_dm") {
        db.addRunEvent(ctx.runId, { type: "dm_sent", taskId: ctx.task.id, to: meta.to, message: meta.message });
      }
      resolve({ exitCode, stdout: out, stderr: err });
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

// node_modules/openai/index.mjs
init_cjs_shims();

// node_modules/openai/client.mjs
init_cjs_shims();

// node_modules/openai/internal/tslib.mjs
init_cjs_shims();
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

// node_modules/openai/internal/utils/uuid.mjs
init_cjs_shims();
var uuid4 = function() {
  const { crypto: crypto3 } = globalThis;
  if (crypto3 == null ? void 0 : crypto3.randomUUID) {
    uuid4 = crypto3.randomUUID.bind(crypto3);
    return crypto3.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte = crypto3 ? () => crypto3.getRandomValues(u8)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ randomByte() & 15 >> +c / 4).toString(16));
};

// node_modules/openai/internal/utils/values.mjs
init_cjs_shims();

// node_modules/openai/core/error.mjs
init_cjs_shims();

// node_modules/openai/internal/errors.mjs
init_cjs_shims();
function isAbortError(err) {
  return typeof err === "object" && err !== null && // Spec-compliant fetch implementations
  ("name" in err && err.name === "AbortError" || // Expo fetch
  "message" in err && String(err.message).includes("FetchRequestCanceledException"));
}
var castToError = (err) => {
  if (err instanceof Error)
    return err;
  if (typeof err === "object" && err !== null) {
    try {
      if (Object.prototype.toString.call(err) === "[object Error]") {
        const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
        if (err.stack)
          error.stack = err.stack;
        if (err.cause && !error.cause)
          error.cause = err.cause;
        if (err.name)
          error.name = err.name;
        return error;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(err));
    } catch {
    }
  }
  return new Error(err);
};

// node_modules/openai/core/error.mjs
var OpenAIError = class extends Error {
};
var APIError = class _APIError extends OpenAIError {
  constructor(status, error, message, headers) {
    super(`${_APIError.makeMessage(status, error, message)}`);
    this.status = status;
    this.headers = headers;
    this.requestID = headers == null ? void 0 : headers.get("x-request-id");
    this.error = error;
    const data = error;
    this.code = data == null ? void 0 : data["code"];
    this.param = data == null ? void 0 : data["param"];
    this.type = data == null ? void 0 : data["type"];
  }
  static makeMessage(status, error, message) {
    const msg = (error == null ? void 0 : error.message) ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
    if (status && msg) {
      return `${status} ${msg}`;
    }
    if (status) {
      return `${status} status code (no body)`;
    }
    if (msg) {
      return msg;
    }
    return "(no status code or body)";
  }
  static generate(status, errorResponse, message, headers) {
    if (!status || !headers) {
      return new APIConnectionError({ message, cause: castToError(errorResponse) });
    }
    const error = errorResponse == null ? void 0 : errorResponse["error"];
    if (status === 400) {
      return new BadRequestError(status, error, message, headers);
    }
    if (status === 401) {
      return new AuthenticationError(status, error, message, headers);
    }
    if (status === 403) {
      return new PermissionDeniedError(status, error, message, headers);
    }
    if (status === 404) {
      return new NotFoundError(status, error, message, headers);
    }
    if (status === 409) {
      return new ConflictError(status, error, message, headers);
    }
    if (status === 422) {
      return new UnprocessableEntityError(status, error, message, headers);
    }
    if (status === 429) {
      return new RateLimitError(status, error, message, headers);
    }
    if (status >= 500) {
      return new InternalServerError(status, error, message, headers);
    }
    return new _APIError(status, error, message, headers);
  }
};
var APIUserAbortError = class extends APIError {
  constructor({ message } = {}) {
    super(void 0, void 0, message || "Request was aborted.", void 0);
  }
};
var APIConnectionError = class extends APIError {
  constructor({ message, cause }) {
    super(void 0, void 0, message || "Connection error.", void 0);
    if (cause)
      this.cause = cause;
  }
};
var APIConnectionTimeoutError = class extends APIConnectionError {
  constructor({ message } = {}) {
    super({ message: message ?? "Request timed out." });
  }
};
var BadRequestError = class extends APIError {
};
var AuthenticationError = class extends APIError {
};
var PermissionDeniedError = class extends APIError {
};
var NotFoundError = class extends APIError {
};
var ConflictError = class extends APIError {
};
var UnprocessableEntityError = class extends APIError {
};
var RateLimitError = class extends APIError {
};
var InternalServerError = class extends APIError {
};
var LengthFinishReasonError = class extends OpenAIError {
  constructor() {
    super(`Could not parse response content as the length limit was reached`);
  }
};
var ContentFilterFinishReasonError = class extends OpenAIError {
  constructor() {
    super(`Could not parse response content as the request was rejected by the content filter`);
  }
};
var InvalidWebhookSignatureError = class extends Error {
  constructor(message) {
    super(message);
  }
};

// node_modules/openai/internal/utils/values.mjs
var startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
var isAbsoluteURL = (url) => {
  return startsWithSchemeRegexp.test(url);
};
var isArray = (val) => (isArray = Array.isArray, isArray(val));
var isReadonlyArray = isArray;
function maybeObj(x) {
  if (typeof x !== "object") {
    return {};
  }
  return x ?? {};
}
function isEmptyObj(obj) {
  if (!obj)
    return true;
  for (const _k in obj)
    return false;
  return true;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function isObj(obj) {
  return obj != null && typeof obj === "object" && !Array.isArray(obj);
}
var validatePositiveInteger = (name, n) => {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new OpenAIError(`${name} must be an integer`);
  }
  if (n < 0) {
    throw new OpenAIError(`${name} must be a positive integer`);
  }
  return n;
};
var safeJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    return void 0;
  }
};

// node_modules/openai/internal/utils/sleep.mjs
init_cjs_shims();
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// node_modules/openai/internal/detect-platform.mjs
init_cjs_shims();

// node_modules/openai/version.mjs
init_cjs_shims();
var VERSION = "5.12.2";

// node_modules/openai/internal/detect-platform.mjs
var isRunningInBrowser = () => {
  return (
    // @ts-ignore
    typeof window !== "undefined" && // @ts-ignore
    typeof window.document !== "undefined" && // @ts-ignore
    typeof navigator !== "undefined"
  );
};
function getDetectedPlatform() {
  if (typeof Deno !== "undefined" && Deno.build != null) {
    return "deno";
  }
  if (typeof EdgeRuntime !== "undefined") {
    return "edge";
  }
  if (Object.prototype.toString.call(typeof globalThis.process !== "undefined" ? globalThis.process : 0) === "[object process]") {
    return "node";
  }
  return "unknown";
}
var getPlatformProperties = () => {
  var _a3;
  const detectedPlatform = getDetectedPlatform();
  if (detectedPlatform === "deno") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(Deno.build.os),
      "X-Stainless-Arch": normalizeArch(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : ((_a3 = Deno.version) == null ? void 0 : _a3.deno) ?? "unknown"
    };
  }
  if (typeof EdgeRuntime !== "undefined") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  }
  if (detectedPlatform === "node") {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": normalizePlatform(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": normalizeArch(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  }
  const browserInfo = getBrowserInfo();
  if (browserInfo) {
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": VERSION,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": "unknown",
      "X-Stainless-Runtime": `browser:${browserInfo.browser}`,
      "X-Stainless-Runtime-Version": browserInfo.version
    };
  }
  return {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": VERSION,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function getBrowserInfo() {
  if (typeof navigator === "undefined" || !navigator) {
    return null;
  }
  const browserPatterns = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key, pattern } of browserPatterns) {
    const match = pattern.exec(navigator.userAgent);
    if (match) {
      const major = match[1] || 0;
      const minor = match[2] || 0;
      const patch = match[3] || 0;
      return { browser: key, version: `${major}.${minor}.${patch}` };
    }
  }
  return null;
}
var normalizeArch = (arch) => {
  if (arch === "x32")
    return "x32";
  if (arch === "x86_64" || arch === "x64")
    return "x64";
  if (arch === "arm")
    return "arm";
  if (arch === "aarch64" || arch === "arm64")
    return "arm64";
  if (arch)
    return `other:${arch}`;
  return "unknown";
};
var normalizePlatform = (platform) => {
  platform = platform.toLowerCase();
  if (platform.includes("ios"))
    return "iOS";
  if (platform === "android")
    return "Android";
  if (platform === "darwin")
    return "MacOS";
  if (platform === "win32")
    return "Windows";
  if (platform === "freebsd")
    return "FreeBSD";
  if (platform === "openbsd")
    return "OpenBSD";
  if (platform === "linux")
    return "Linux";
  if (platform)
    return `Other:${platform}`;
  return "Unknown";
};
var _platformHeaders;
var getPlatformHeaders = () => {
  return _platformHeaders ?? (_platformHeaders = getPlatformProperties());
};

// node_modules/openai/internal/shims.mjs
init_cjs_shims();
function getDefaultFetch() {
  if (typeof fetch !== "undefined") {
    return fetch;
  }
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new OpenAI({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function makeReadableStream(...args) {
  const ReadableStream = globalThis.ReadableStream;
  if (typeof ReadableStream === "undefined") {
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  }
  return new ReadableStream(...args);
}
function ReadableStreamFrom(iterable) {
  let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
  return makeReadableStream({
    start() {
    },
    async pull(controller) {
      const { done, value } = await iter.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel() {
      var _a3;
      await ((_a3 = iter.return) == null ? void 0 : _a3.call(iter));
    }
  });
}
function ReadableStreamToAsyncIterable(stream) {
  if (stream[Symbol.asyncIterator])
    return stream;
  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result == null ? void 0 : result.done)
          reader.releaseLock();
        return result;
      } catch (e) {
        reader.releaseLock();
        throw e;
      }
    },
    async return() {
      const cancelPromise = reader.cancel();
      reader.releaseLock();
      await cancelPromise;
      return { done: true, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function CancelReadableStream(stream) {
  var _a3, _b;
  if (stream === null || typeof stream !== "object")
    return;
  if (stream[Symbol.asyncIterator]) {
    await ((_b = (_a3 = stream[Symbol.asyncIterator]()).return) == null ? void 0 : _b.call(_a3));
    return;
  }
  const reader = stream.getReader();
  const cancelPromise = reader.cancel();
  reader.releaseLock();
  await cancelPromise;
}

// node_modules/openai/internal/request-options.mjs
init_cjs_shims();
var FallbackEncoder = ({ headers, body }) => {
  return {
    bodyHeaders: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

// node_modules/openai/internal/qs/index.mjs
init_cjs_shims();

// node_modules/openai/internal/qs/formats.mjs
init_cjs_shims();
var default_format = "RFC3986";
var default_formatter = (v) => String(v);
var formatters = {
  RFC1738: (v) => String(v).replace(/%20/g, "+"),
  RFC3986: default_formatter
};
var RFC1738 = "RFC1738";

// node_modules/openai/internal/qs/stringify.mjs
init_cjs_shims();

// node_modules/openai/internal/qs/utils.mjs
init_cjs_shims();
var has = (obj, key) => (has = Object.hasOwn ?? Function.prototype.call.bind(Object.prototype.hasOwnProperty), has(obj, key));
var hex_table = /* @__PURE__ */ (() => {
  const array = [];
  for (let i = 0; i < 256; ++i) {
    array.push("%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase());
  }
  return array;
})();
var limit = 1024;
var encode = (str2, _defaultEncoder, charset, _kind, format) => {
  if (str2.length === 0) {
    return str2;
  }
  let string = str2;
  if (typeof str2 === "symbol") {
    string = Symbol.prototype.toString.call(str2);
  } else if (typeof str2 !== "string") {
    string = String(str2);
  }
  if (charset === "iso-8859-1") {
    return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
      return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
    });
  }
  let out = "";
  for (let j = 0; j < string.length; j += limit) {
    const segment = string.length >= limit ? string.slice(j, j + limit) : string;
    const arr = [];
    for (let i = 0; i < segment.length; ++i) {
      let c = segment.charCodeAt(i);
      if (c === 45 || // -
      c === 46 || // .
      c === 95 || // _
      c === 126 || // ~
      c >= 48 && c <= 57 || // 0-9
      c >= 65 && c <= 90 || // a-z
      c >= 97 && c <= 122 || // A-Z
      format === RFC1738 && (c === 40 || c === 41)) {
        arr[arr.length] = segment.charAt(i);
        continue;
      }
      if (c < 128) {
        arr[arr.length] = hex_table[c];
        continue;
      }
      if (c < 2048) {
        arr[arr.length] = hex_table[192 | c >> 6] + hex_table[128 | c & 63];
        continue;
      }
      if (c < 55296 || c >= 57344) {
        arr[arr.length] = hex_table[224 | c >> 12] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
        continue;
      }
      i += 1;
      c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
      arr[arr.length] = hex_table[240 | c >> 18] + hex_table[128 | c >> 12 & 63] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
    }
    out += arr.join("");
  }
  return out;
};
function is_buffer(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
function maybe_map(val, fn) {
  if (isArray(val)) {
    const mapped = [];
    for (let i = 0; i < val.length; i += 1) {
      mapped.push(fn(val[i]));
    }
    return mapped;
  }
  return fn(val);
}

// node_modules/openai/internal/qs/stringify.mjs
var array_prefix_generators = {
  brackets(prefix) {
    return String(prefix) + "[]";
  },
  comma: "comma",
  indices(prefix, key) {
    return String(prefix) + "[" + key + "]";
  },
  repeat(prefix) {
    return String(prefix);
  }
};
var push_to_array = function(arr, value_or_array) {
  Array.prototype.push.apply(arr, isArray(value_or_array) ? value_or_array : [value_or_array]);
};
var toISOString;
var defaults = {
  addQueryPrefix: false,
  allowDots: false,
  allowEmptyArrays: false,
  arrayFormat: "indices",
  charset: "utf-8",
  charsetSentinel: false,
  delimiter: "&",
  encode: true,
  encodeDotInKeys: false,
  encoder: encode,
  encodeValuesOnly: false,
  format: default_format,
  formatter: default_formatter,
  /** @deprecated */
  indices: false,
  serializeDate(date) {
    return (toISOString ?? (toISOString = Function.prototype.call.bind(Date.prototype.toISOString)))(date);
  },
  skipNulls: false,
  strictNullHandling: false
};
function is_non_nullish_primitive(v) {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
}
var sentinel = {};
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
  let obj = object;
  let tmp_sc = sideChannel;
  let step = 0;
  let find_flag = false;
  while ((tmp_sc = tmp_sc.get(sentinel)) !== void 0 && !find_flag) {
    const pos = tmp_sc.get(object);
    step += 1;
    if (typeof pos !== "undefined") {
      if (pos === step) {
        throw new RangeError("Cyclic object value");
      } else {
        find_flag = true;
      }
    }
    if (typeof tmp_sc.get(sentinel) === "undefined") {
      step = 0;
    }
  }
  if (typeof filter === "function") {
    obj = filter(prefix, obj);
  } else if (obj instanceof Date) {
    obj = serializeDate == null ? void 0 : serializeDate(obj);
  } else if (generateArrayPrefix === "comma" && isArray(obj)) {
    obj = maybe_map(obj, function(value) {
      if (value instanceof Date) {
        return serializeDate == null ? void 0 : serializeDate(value);
      }
      return value;
    });
  }
  if (obj === null) {
    if (strictNullHandling) {
      return encoder && !encodeValuesOnly ? (
        // @ts-expect-error
        encoder(prefix, defaults.encoder, charset, "key", format)
      ) : prefix;
    }
    obj = "";
  }
  if (is_non_nullish_primitive(obj) || is_buffer(obj)) {
    if (encoder) {
      const key_value = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, "key", format);
      return [
        (formatter == null ? void 0 : formatter(key_value)) + "=" + // @ts-expect-error
        (formatter == null ? void 0 : formatter(encoder(obj, defaults.encoder, charset, "value", format)))
      ];
    }
    return [(formatter == null ? void 0 : formatter(prefix)) + "=" + (formatter == null ? void 0 : formatter(String(obj)))];
  }
  const values = [];
  if (typeof obj === "undefined") {
    return values;
  }
  let obj_keys;
  if (generateArrayPrefix === "comma" && isArray(obj)) {
    if (encodeValuesOnly && encoder) {
      obj = maybe_map(obj, encoder);
    }
    obj_keys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
  } else if (isArray(filter)) {
    obj_keys = filter;
  } else {
    const keys = Object.keys(obj);
    obj_keys = sort ? keys.sort(sort) : keys;
  }
  const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
  const adjusted_prefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encoded_prefix + "[]" : encoded_prefix;
  if (allowEmptyArrays && isArray(obj) && obj.length === 0) {
    return adjusted_prefix + "[]";
  }
  for (let j = 0; j < obj_keys.length; ++j) {
    const key = obj_keys[j];
    const value = (
      // @ts-ignore
      typeof key === "object" && typeof key.value !== "undefined" ? key.value : obj[key]
    );
    if (skipNulls && value === null) {
      continue;
    }
    const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, "%2E") : key;
    const key_prefix = isArray(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjusted_prefix, encoded_key) : adjusted_prefix : adjusted_prefix + (allowDots ? "." + encoded_key : "[" + encoded_key + "]");
    sideChannel.set(object, step);
    const valueSideChannel = /* @__PURE__ */ new WeakMap();
    valueSideChannel.set(sentinel, sideChannel);
    push_to_array(values, inner_stringify(
      value,
      key_prefix,
      generateArrayPrefix,
      commaRoundTrip,
      allowEmptyArrays,
      strictNullHandling,
      skipNulls,
      encodeDotInKeys,
      // @ts-ignore
      generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder,
      filter,
      sort,
      allowDots,
      serializeDate,
      format,
      formatter,
      encodeValuesOnly,
      charset,
      valueSideChannel
    ));
  }
  return values;
}
function normalize_stringify_options(opts = defaults) {
  if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
    throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
  }
  if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") {
    throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
  }
  if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") {
    throw new TypeError("Encoder has to be a function.");
  }
  const charset = opts.charset || defaults.charset;
  if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
    throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
  }
  let format = default_format;
  if (typeof opts.format !== "undefined") {
    if (!has(formatters, opts.format)) {
      throw new TypeError("Unknown format option provided.");
    }
    format = opts.format;
  }
  const formatter = formatters[format];
  let filter = defaults.filter;
  if (typeof opts.filter === "function" || isArray(opts.filter)) {
    filter = opts.filter;
  }
  let arrayFormat;
  if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) {
    arrayFormat = opts.arrayFormat;
  } else if ("indices" in opts) {
    arrayFormat = opts.indices ? "indices" : "repeat";
  } else {
    arrayFormat = defaults.arrayFormat;
  }
  if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
    throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
  }
  const allowDots = typeof opts.allowDots === "undefined" ? !!opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
  return {
    addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
    // @ts-ignore
    allowDots,
    allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
    arrayFormat,
    charset,
    charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
    commaRoundTrip: !!opts.commaRoundTrip,
    delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
    encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
    encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
    encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
    encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
    filter,
    format,
    formatter,
    serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
    skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
    // @ts-ignore
    sort: typeof opts.sort === "function" ? opts.sort : null,
    strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
  };
}
function stringify(object, opts = {}) {
  let obj = object;
  const options = normalize_stringify_options(opts);
  let obj_keys;
  let filter;
  if (typeof options.filter === "function") {
    filter = options.filter;
    obj = filter("", obj);
  } else if (isArray(options.filter)) {
    filter = options.filter;
    obj_keys = filter;
  }
  const keys = [];
  if (typeof obj !== "object" || obj === null) {
    return "";
  }
  const generateArrayPrefix = array_prefix_generators[options.arrayFormat];
  const commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
  if (!obj_keys) {
    obj_keys = Object.keys(obj);
  }
  if (options.sort) {
    obj_keys.sort(options.sort);
  }
  const sideChannel = /* @__PURE__ */ new WeakMap();
  for (let i = 0; i < obj_keys.length; ++i) {
    const key = obj_keys[i];
    if (options.skipNulls && obj[key] === null) {
      continue;
    }
    push_to_array(keys, inner_stringify(
      obj[key],
      key,
      // @ts-expect-error
      generateArrayPrefix,
      commaRoundTrip,
      options.allowEmptyArrays,
      options.strictNullHandling,
      options.skipNulls,
      options.encodeDotInKeys,
      options.encode ? options.encoder : null,
      options.filter,
      options.sort,
      options.allowDots,
      options.serializeDate,
      options.format,
      options.formatter,
      options.encodeValuesOnly,
      options.charset,
      sideChannel
    ));
  }
  const joined = keys.join(options.delimiter);
  let prefix = options.addQueryPrefix === true ? "?" : "";
  if (options.charsetSentinel) {
    if (options.charset === "iso-8859-1") {
      prefix += "utf8=%26%2310003%3B&";
    } else {
      prefix += "utf8=%E2%9C%93&";
    }
  }
  return joined.length > 0 ? prefix + joined : "";
}

// node_modules/openai/core/pagination.mjs
init_cjs_shims();

// node_modules/openai/internal/parse.mjs
init_cjs_shims();

// node_modules/openai/core/streaming.mjs
init_cjs_shims();

// node_modules/openai/internal/decoders/line.mjs
init_cjs_shims();

// node_modules/openai/internal/utils/bytes.mjs
init_cjs_shims();
function concatBytes(buffers) {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }
  return output;
}
var encodeUTF8_;
function encodeUTF8(str2) {
  let encoder;
  return (encodeUTF8_ ?? (encoder = new globalThis.TextEncoder(), encodeUTF8_ = encoder.encode.bind(encoder)))(str2);
}
var decodeUTF8_;
function decodeUTF8(bytes) {
  let decoder;
  return (decodeUTF8_ ?? (decoder = new globalThis.TextDecoder(), decodeUTF8_ = decoder.decode.bind(decoder)))(bytes);
}

// node_modules/openai/internal/decoders/line.mjs
var _LineDecoder_buffer;
var _LineDecoder_carriageReturnIndex;
var LineDecoder = class {
  constructor() {
    _LineDecoder_buffer.set(this, void 0);
    _LineDecoder_carriageReturnIndex.set(this, void 0);
    __classPrivateFieldSet(this, _LineDecoder_buffer, new Uint8Array(), "f");
    __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
  }
  decode(chunk) {
    if (chunk == null) {
      return [];
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    __classPrivateFieldSet(this, _LineDecoder_buffer, concatBytes([__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), binaryChunk]), "f");
    const lines = [];
    let patternIndex;
    while ((patternIndex = findNewlineIndex(__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"))) != null) {
      if (patternIndex.carriage && __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") == null) {
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, patternIndex.index, "f");
        continue;
      }
      if (__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") != null && (patternIndex.index !== __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") + 1 || patternIndex.carriage)) {
        lines.push(decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") - 1)));
        __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f")), "f");
        __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
        continue;
      }
      const endIndex = __classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") !== null ? patternIndex.preceding - 1 : patternIndex.preceding;
      const line = decodeUTF8(__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, endIndex));
      lines.push(line);
      __classPrivateFieldSet(this, _LineDecoder_buffer, __classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(patternIndex.index), "f");
      __classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
    }
    return lines;
  }
  flush() {
    if (!__classPrivateFieldGet(this, _LineDecoder_buffer, "f").length) {
      return [];
    }
    return this.decode("\n");
  }
};
_LineDecoder_buffer = /* @__PURE__ */ new WeakMap(), _LineDecoder_carriageReturnIndex = /* @__PURE__ */ new WeakMap();
LineDecoder.NEWLINE_CHARS = /* @__PURE__ */ new Set(["\n", "\r"]);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function findNewlineIndex(buffer, startIndex) {
  const newline = 10;
  const carriage = 13;
  for (let i = startIndex ?? 0; i < buffer.length; i++) {
    if (buffer[i] === newline) {
      return { preceding: i, index: i + 1, carriage: false };
    }
    if (buffer[i] === carriage) {
      return { preceding: i, index: i + 1, carriage: true };
    }
  }
  return null;
}
function findDoubleNewlineIndex(buffer) {
  const newline = 10;
  const carriage = 13;
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === newline && buffer[i + 1] === newline) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === carriage) {
      return i + 2;
    }
    if (buffer[i] === carriage && buffer[i + 1] === newline && i + 3 < buffer.length && buffer[i + 2] === carriage && buffer[i + 3] === newline) {
      return i + 4;
    }
  }
  return -1;
}

// node_modules/openai/internal/utils/log.mjs
init_cjs_shims();
var levelNumbers = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
};
var parseLogLevel = (maybeLevel, sourceName, client) => {
  if (!maybeLevel) {
    return void 0;
  }
  if (hasOwn(levelNumbers, maybeLevel)) {
    return maybeLevel;
  }
  loggerFor(client).warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
  return void 0;
};
function noop() {
}
function makeLogFn(fnLevel, logger2, logLevel) {
  if (!logger2 || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
    return noop;
  } else {
    return logger2[fnLevel].bind(logger2);
  }
}
var noopLogger = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop
};
var cachedLoggers = /* @__PURE__ */ new WeakMap();
function loggerFor(client) {
  const logger2 = client.logger;
  const logLevel = client.logLevel ?? "off";
  if (!logger2) {
    return noopLogger;
  }
  const cachedLogger = cachedLoggers.get(logger2);
  if (cachedLogger && cachedLogger[0] === logLevel) {
    return cachedLogger[1];
  }
  const levelLogger = {
    error: makeLogFn("error", logger2, logLevel),
    warn: makeLogFn("warn", logger2, logLevel),
    info: makeLogFn("info", logger2, logLevel),
    debug: makeLogFn("debug", logger2, logLevel)
  };
  cachedLoggers.set(logger2, [logLevel, levelLogger]);
  return levelLogger;
}
var formatRequestDetails = (details) => {
  if (details.options) {
    details.options = { ...details.options };
    delete details.options["headers"];
  }
  if (details.headers) {
    details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [
      name,
      name.toLowerCase() === "authorization" || name.toLowerCase() === "cookie" || name.toLowerCase() === "set-cookie" ? "***" : value
    ]));
  }
  if ("retryOfRequestLogID" in details) {
    if (details.retryOfRequestLogID) {
      details.retryOf = details.retryOfRequestLogID;
    }
    delete details.retryOfRequestLogID;
  }
  return details;
};

// node_modules/openai/core/streaming.mjs
var _Stream_client;
var Stream = class _Stream {
  constructor(iterator, controller, client) {
    this.iterator = iterator;
    _Stream_client.set(this, void 0);
    this.controller = controller;
    __classPrivateFieldSet(this, _Stream_client, client, "f");
  }
  static fromSSEResponse(response, controller, client) {
    let consumed = false;
    const logger2 = client ? loggerFor(client) : console;
    async function* iterator() {
      if (consumed) {
        throw new OpenAIError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      try {
        for await (const sse of _iterSSEMessages(response, controller)) {
          if (done)
            continue;
          if (sse.data.startsWith("[DONE]")) {
            done = true;
            continue;
          }
          if (sse.event === null || !sse.event.startsWith("thread.")) {
            let data;
            try {
              data = JSON.parse(sse.data);
            } catch (e) {
              logger2.error(`Could not parse message into JSON:`, sse.data);
              logger2.error(`From chunk:`, sse.raw);
              throw e;
            }
            if (data && data.error) {
              throw new APIError(void 0, data.error, void 0, response.headers);
            }
            yield data;
          } else {
            let data;
            try {
              data = JSON.parse(sse.data);
            } catch (e) {
              console.error(`Could not parse message into JSON:`, sse.data);
              console.error(`From chunk:`, sse.raw);
              throw e;
            }
            if (sse.event == "error") {
              throw new APIError(void 0, data.error, data.message, void 0);
            }
            yield { event: sse.event, data };
          }
        }
        done = true;
      } catch (e) {
        if (isAbortError(e))
          return;
        throw e;
      } finally {
        if (!done)
          controller.abort();
      }
    }
    return new _Stream(iterator, controller, client);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(readableStream, controller, client) {
    let consumed = false;
    async function* iterLines() {
      const lineDecoder = new LineDecoder();
      const iter = ReadableStreamToAsyncIterable(readableStream);
      for await (const chunk of iter) {
        for (const line of lineDecoder.decode(chunk)) {
          yield line;
        }
      }
      for (const line of lineDecoder.flush()) {
        yield line;
      }
    }
    async function* iterator() {
      if (consumed) {
        throw new OpenAIError("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      }
      consumed = true;
      let done = false;
      try {
        for await (const line of iterLines()) {
          if (done)
            continue;
          if (line)
            yield JSON.parse(line);
        }
        done = true;
      } catch (e) {
        if (isAbortError(e))
          return;
        throw e;
      } finally {
        if (!done)
          controller.abort();
      }
    }
    return new _Stream(iterator, controller, client);
  }
  [(_Stream_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const left = [];
    const right = [];
    const iterator = this.iterator();
    const teeIterator = (queue) => {
      return {
        next: () => {
          if (queue.length === 0) {
            const result = iterator.next();
            left.push(result);
            right.push(result);
          }
          return queue.shift();
        }
      };
    };
    return [
      new _Stream(() => teeIterator(left), this.controller, __classPrivateFieldGet(this, _Stream_client, "f")),
      new _Stream(() => teeIterator(right), this.controller, __classPrivateFieldGet(this, _Stream_client, "f"))
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const self = this;
    let iter;
    return makeReadableStream({
      async start() {
        iter = self[Symbol.asyncIterator]();
      },
      async pull(ctrl) {
        try {
          const { value, done } = await iter.next();
          if (done)
            return ctrl.close();
          const bytes = encodeUTF8(JSON.stringify(value) + "\n");
          ctrl.enqueue(bytes);
        } catch (err) {
          ctrl.error(err);
        }
      },
      async cancel() {
        var _a3;
        await ((_a3 = iter.return) == null ? void 0 : _a3.call(iter));
      }
    });
  }
};
async function* _iterSSEMessages(response, controller) {
  if (!response.body) {
    controller.abort();
    if (typeof globalThis.navigator !== "undefined" && globalThis.navigator.product === "ReactNative") {
      throw new OpenAIError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
    }
    throw new OpenAIError(`Attempted to iterate over a response with no body`);
  }
  const sseDecoder = new SSEDecoder();
  const lineDecoder = new LineDecoder();
  const iter = ReadableStreamToAsyncIterable(response.body);
  for await (const sseChunk of iterSSEChunks(iter)) {
    for (const line of lineDecoder.decode(sseChunk)) {
      const sse = sseDecoder.decode(line);
      if (sse)
        yield sse;
    }
  }
  for (const line of lineDecoder.flush()) {
    const sse = sseDecoder.decode(line);
    if (sse)
      yield sse;
  }
}
async function* iterSSEChunks(iterator) {
  let data = new Uint8Array();
  for await (const chunk of iterator) {
    if (chunk == null) {
      continue;
    }
    const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : typeof chunk === "string" ? encodeUTF8(chunk) : chunk;
    let newData = new Uint8Array(data.length + binaryChunk.length);
    newData.set(data);
    newData.set(binaryChunk, data.length);
    data = newData;
    let patternIndex;
    while ((patternIndex = findDoubleNewlineIndex(data)) !== -1) {
      yield data.slice(0, patternIndex);
      data = data.slice(patternIndex);
    }
  }
  if (data.length > 0) {
    yield data;
  }
}
var SSEDecoder = class {
  constructor() {
    this.event = null;
    this.data = [];
    this.chunks = [];
  }
  decode(line) {
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }
    if (!line) {
      if (!this.event && !this.data.length)
        return null;
      const sse = {
        event: this.event,
        data: this.data.join("\n"),
        raw: this.chunks
      };
      this.event = null;
      this.data = [];
      this.chunks = [];
      return sse;
    }
    this.chunks.push(line);
    if (line.startsWith(":")) {
      return null;
    }
    let [fieldname, _, value] = partition(line, ":");
    if (value.startsWith(" ")) {
      value = value.substring(1);
    }
    if (fieldname === "event") {
      this.event = value;
    } else if (fieldname === "data") {
      this.data.push(value);
    }
    return null;
  }
};
function partition(str2, delimiter) {
  const index = str2.indexOf(delimiter);
  if (index !== -1) {
    return [str2.substring(0, index), delimiter, str2.substring(index + delimiter.length)];
  }
  return [str2, "", ""];
}

// node_modules/openai/internal/parse.mjs
async function defaultParseResponse(client, props) {
  const { response, requestLogID, retryOfRequestLogID, startTime } = props;
  const body = await (async () => {
    var _a3;
    if (props.options.stream) {
      loggerFor(client).debug("response", response.status, response.url, response.headers, response.body);
      if (props.options.__streamClass) {
        return props.options.__streamClass.fromSSEResponse(response, props.controller, client);
      }
      return Stream.fromSSEResponse(response, props.controller, client);
    }
    if (response.status === 204) {
      return null;
    }
    if (props.options.__binaryResponse) {
      return response;
    }
    const contentType = response.headers.get("content-type");
    const mediaType = (_a3 = contentType == null ? void 0 : contentType.split(";")[0]) == null ? void 0 : _a3.trim();
    const isJSON = (mediaType == null ? void 0 : mediaType.includes("application/json")) || (mediaType == null ? void 0 : mediaType.endsWith("+json"));
    if (isJSON) {
      const json = await response.json();
      return addRequestID(json, response);
    }
    const text = await response.text();
    return text;
  })();
  loggerFor(client).debug(`[${requestLogID}] response parsed`, formatRequestDetails({
    retryOfRequestLogID,
    url: response.url,
    status: response.status,
    body,
    durationMs: Date.now() - startTime
  }));
  return body;
}
function addRequestID(value, response) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.defineProperty(value, "_request_id", {
    value: response.headers.get("x-request-id"),
    enumerable: false
  });
}

// node_modules/openai/core/api-promise.mjs
init_cjs_shims();
var _APIPromise_client;
var APIPromise = class _APIPromise extends Promise {
  constructor(client, responsePromise, parseResponse2 = defaultParseResponse) {
    super((resolve) => {
      resolve(null);
    });
    this.responsePromise = responsePromise;
    this.parseResponse = parseResponse2;
    _APIPromise_client.set(this, void 0);
    __classPrivateFieldSet(this, _APIPromise_client, client, "f");
  }
  _thenUnwrap(transform) {
    return new _APIPromise(__classPrivateFieldGet(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => addRequestID(transform(await this.parseResponse(client, props), props), props.response));
  }
  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  asResponse() {
    return this.responsePromise.then((p) => p.response);
  }
  /**
   * Gets the parsed response data, the raw `Response` instance and the ID of the request,
   * returned via the X-Request-ID header which is useful for debugging requests and reporting
   * issues to OpenAI.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse() {
    const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
    return { data, response, request_id: response.headers.get("x-request-id") };
  }
  parse() {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(__classPrivateFieldGet(this, _APIPromise_client, "f"), data));
    }
    return this.parsedPromise;
  }
  then(onfulfilled, onrejected) {
    return this.parse().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.parse().catch(onrejected);
  }
  finally(onfinally) {
    return this.parse().finally(onfinally);
  }
};
_APIPromise_client = /* @__PURE__ */ new WeakMap();

// node_modules/openai/core/pagination.mjs
var _AbstractPage_client;
var AbstractPage = class {
  constructor(client, response, body, options) {
    _AbstractPage_client.set(this, void 0);
    __classPrivateFieldSet(this, _AbstractPage_client, client, "f");
    this.options = options;
    this.response = response;
    this.body = body;
  }
  hasNextPage() {
    const items = this.getPaginatedItems();
    if (!items.length)
      return false;
    return this.nextPageRequestOptions() != null;
  }
  async getNextPage() {
    const nextOptions = this.nextPageRequestOptions();
    if (!nextOptions) {
      throw new OpenAIError("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
    }
    return await __classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
  }
  async *iterPages() {
    let page = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }
  async *[(_AbstractPage_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    for await (const page of this.iterPages()) {
      for (const item of page.getPaginatedItems()) {
        yield item;
      }
    }
  }
};
var PagePromise = class extends APIPromise {
  constructor(client, request, Page2) {
    super(client, request, async (client2, props) => new Page2(client2, props.response, await defaultParseResponse(client2, props), props.options));
  }
  /**
   * Allow auto-paginating iteration on an unawaited list call, eg:
   *
   *    for await (const item of client.items.list()) {
   *      console.log(item)
   *    }
   */
  async *[Symbol.asyncIterator]() {
    const page = await this;
    for await (const item of page) {
      yield item;
    }
  }
};
var Page = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.object = body.object;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  nextPageRequestOptions() {
    return null;
  }
};
var CursorPage = class extends AbstractPage {
  constructor(client, response, body, options) {
    super(client, response, body, options);
    this.data = body.data || [];
    this.has_more = body.has_more || false;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    if (this.has_more === false) {
      return false;
    }
    return super.hasNextPage();
  }
  nextPageRequestOptions() {
    var _a3;
    const data = this.getPaginatedItems();
    const id = (_a3 = data[data.length - 1]) == null ? void 0 : _a3.id;
    if (!id) {
      return null;
    }
    return {
      ...this.options,
      query: {
        ...maybeObj(this.options.query),
        after: id
      }
    };
  }
};

// node_modules/openai/core/uploads.mjs
init_cjs_shims();

// node_modules/openai/internal/to-file.mjs
init_cjs_shims();

// node_modules/openai/internal/uploads.mjs
init_cjs_shims();
var checkFileSupport = () => {
  var _a3;
  if (typeof File === "undefined") {
    const { process: process2 } = globalThis;
    const isOldNode = typeof ((_a3 = process2 == null ? void 0 : process2.versions) == null ? void 0 : _a3.node) === "string" && parseInt(process2.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (isOldNode ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function makeFile(fileBits, fileName, options) {
  checkFileSupport();
  return new File(fileBits, fileName ?? "unknown_file", options);
}
function getName(value) {
  return (typeof value === "object" && value !== null && ("name" in value && value.name && String(value.name) || "url" in value && value.url && String(value.url) || "filename" in value && value.filename && String(value.filename) || "path" in value && value.path && String(value.path)) || "").split(/[\\/]/).pop() || void 0;
}
var isAsyncIterable = (value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function";
var multipartFormRequestOptions = async (opts, fetch2) => {
  return { ...opts, body: await createForm(opts.body, fetch2) };
};
var supportsFormDataMap = /* @__PURE__ */ new WeakMap();
function supportsFormData(fetchObject) {
  const fetch2 = typeof fetchObject === "function" ? fetchObject : fetchObject.fetch;
  const cached = supportsFormDataMap.get(fetch2);
  if (cached)
    return cached;
  const promise = (async () => {
    try {
      const FetchResponse = "Response" in fetch2 ? fetch2.Response : (await fetch2("data:,")).constructor;
      const data = new FormData();
      if (data.toString() === await new FetchResponse(data).text()) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  })();
  supportsFormDataMap.set(fetch2, promise);
  return promise;
}
var createForm = async (body, fetch2) => {
  if (!await supportsFormData(fetch2)) {
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  }
  const form = new FormData();
  await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value)));
  return form;
};
var isNamedBlob = (value) => value instanceof Blob && "name" in value;
var addFormValue = async (form, key, value) => {
  if (value === void 0)
    return;
  if (value == null) {
    throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    form.append(key, String(value));
  } else if (value instanceof Response) {
    form.append(key, makeFile([await value.blob()], getName(value)));
  } else if (isAsyncIterable(value)) {
    form.append(key, makeFile([await new Response(ReadableStreamFrom(value)).blob()], getName(value)));
  } else if (isNamedBlob(value)) {
    form.append(key, value, getName(value));
  } else if (Array.isArray(value)) {
    await Promise.all(value.map((entry) => addFormValue(form, key + "[]", entry)));
  } else if (typeof value === "object") {
    await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop)));
  } else {
    throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
  }
};

// node_modules/openai/internal/to-file.mjs
var isBlobLike = (value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function";
var isFileLike = (value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value);
var isResponseLike = (value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function";
async function toFile(value, name, options) {
  checkFileSupport();
  value = await value;
  if (isFileLike(value)) {
    if (value instanceof File) {
      return value;
    }
    return makeFile([await value.arrayBuffer()], value.name);
  }
  if (isResponseLike(value)) {
    const blob = await value.blob();
    name || (name = new URL(value.url).pathname.split(/[\\/]/).pop());
    return makeFile(await getBytes(blob), name, options);
  }
  const parts = await getBytes(value);
  name || (name = getName(value));
  if (!(options == null ? void 0 : options.type)) {
    const type = parts.find((part) => typeof part === "object" && "type" in part && part.type);
    if (typeof type === "string") {
      options = { ...options, type };
    }
  }
  return makeFile(parts, name, options);
}
async function getBytes(value) {
  var _a3;
  let parts = [];
  if (typeof value === "string" || ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
  value instanceof ArrayBuffer) {
    parts.push(value);
  } else if (isBlobLike(value)) {
    parts.push(value instanceof Blob ? value : await value.arrayBuffer());
  } else if (isAsyncIterable(value)) {
    for await (const chunk of value) {
      parts.push(...await getBytes(chunk));
    }
  } else {
    const constructor = (_a3 = value == null ? void 0 : value.constructor) == null ? void 0 : _a3.name;
    throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ""}${propsForError(value)}`);
  }
  return parts;
}
function propsForError(value) {
  if (typeof value !== "object" || value === null)
    return "";
  const props = Object.getOwnPropertyNames(value);
  return `; props: [${props.map((p) => `"${p}"`).join(", ")}]`;
}

// node_modules/openai/resources/index.mjs
init_cjs_shims();

// node_modules/openai/resources/chat/index.mjs
init_cjs_shims();

// node_modules/openai/resources/chat/chat.mjs
init_cjs_shims();

// node_modules/openai/core/resource.mjs
init_cjs_shims();
var APIResource = class {
  constructor(client) {
    this._client = client;
  }
};

// node_modules/openai/resources/chat/completions/completions.mjs
init_cjs_shims();

// node_modules/openai/resources/chat/completions/messages.mjs
init_cjs_shims();

// node_modules/openai/internal/utils/path.mjs
init_cjs_shims();
function encodeURIPath(str2) {
  return str2.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
var EMPTY = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
var createPathTagFunction = (pathEncoder = encodeURIPath) => function path11(statics, ...params) {
  if (statics.length === 1)
    return statics[0];
  let postPath = false;
  const invalidSegments = [];
  const path12 = statics.reduce((previousValue, currentValue, index) => {
    var _a3;
    if (/[?#]/.test(currentValue)) {
      postPath = true;
    }
    const value = params[index];
    let encoded = (postPath ? encodeURIComponent : pathEncoder)("" + value);
    if (index !== params.length && (value == null || typeof value === "object" && // handle values from other realms
    value.toString === ((_a3 = Object.getPrototypeOf(Object.getPrototypeOf(value.hasOwnProperty ?? EMPTY) ?? EMPTY)) == null ? void 0 : _a3.toString))) {
      encoded = value + "";
      invalidSegments.push({
        start: previousValue.length + currentValue.length,
        length: encoded.length,
        error: `Value of type ${Object.prototype.toString.call(value).slice(8, -1)} is not a valid path parameter`
      });
    }
    return previousValue + currentValue + (index === params.length ? "" : encoded);
  }, "");
  const pathOnly = path12.split(/[?#]/, 1)[0];
  const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let match;
  while ((match = invalidSegmentPattern.exec(pathOnly)) !== null) {
    invalidSegments.push({
      start: match.index,
      length: match[0].length,
      error: `Value "${match[0]}" can't be safely passed as a path parameter`
    });
  }
  invalidSegments.sort((a, b) => a.start - b.start);
  if (invalidSegments.length > 0) {
    let lastEnd = 0;
    const underline = invalidSegments.reduce((acc, segment) => {
      const spaces = " ".repeat(segment.start - lastEnd);
      const arrows = "^".repeat(segment.length);
      lastEnd = segment.start + segment.length;
      return acc + spaces + arrows;
    }, "");
    throw new OpenAIError(`Path parameters result in path with invalid segments:
${invalidSegments.map((e) => e.error).join("\n")}
${path12}
${underline}`);
  }
  return path12;
};
var path5 = /* @__PURE__ */ createPathTagFunction(encodeURIPath);

// node_modules/openai/resources/chat/completions/messages.mjs
var Messages = class extends APIResource {
  /**
   * Get the messages in a stored chat completion. Only Chat Completions that have
   * been created with the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatCompletionStoreMessage of client.chat.completions.messages.list(
   *   'completion_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(completionID, query = {}, options) {
    return this._client.getAPIList(path5`/chat/completions/${completionID}/messages`, CursorPage, { query, ...options });
  }
};

// node_modules/openai/lib/ChatCompletionRunner.mjs
init_cjs_shims();

// node_modules/openai/lib/AbstractChatCompletionRunner.mjs
init_cjs_shims();

// node_modules/openai/error.mjs
init_cjs_shims();

// node_modules/openai/lib/parser.mjs
init_cjs_shims();
function isChatCompletionFunctionTool(tool) {
  return tool !== void 0 && "function" in tool && tool.function !== void 0;
}
function isAutoParsableResponseFormat(response_format) {
  return (response_format == null ? void 0 : response_format["$brand"]) === "auto-parseable-response-format";
}
function isAutoParsableTool(tool) {
  return (tool == null ? void 0 : tool["$brand"]) === "auto-parseable-tool";
}
function maybeParseChatCompletion(completion, params) {
  if (!params || !hasAutoParseableInput(params)) {
    return {
      ...completion,
      choices: completion.choices.map((choice) => {
        assertToolCallsAreChatCompletionFunctionToolCalls(choice.message.tool_calls);
        return {
          ...choice,
          message: {
            ...choice.message,
            parsed: null,
            ...choice.message.tool_calls ? {
              tool_calls: choice.message.tool_calls
            } : void 0
          }
        };
      })
    };
  }
  return parseChatCompletion(completion, params);
}
function parseChatCompletion(completion, params) {
  const choices = completion.choices.map((choice) => {
    var _a3;
    if (choice.finish_reason === "length") {
      throw new LengthFinishReasonError();
    }
    if (choice.finish_reason === "content_filter") {
      throw new ContentFilterFinishReasonError();
    }
    assertToolCallsAreChatCompletionFunctionToolCalls(choice.message.tool_calls);
    return {
      ...choice,
      message: {
        ...choice.message,
        ...choice.message.tool_calls ? {
          tool_calls: ((_a3 = choice.message.tool_calls) == null ? void 0 : _a3.map((toolCall) => parseToolCall(params, toolCall))) ?? void 0
        } : void 0,
        parsed: choice.message.content && !choice.message.refusal ? parseResponseFormat(params, choice.message.content) : null
      }
    };
  });
  return { ...completion, choices };
}
function parseResponseFormat(params, content) {
  var _a3, _b;
  if (((_a3 = params.response_format) == null ? void 0 : _a3.type) !== "json_schema") {
    return null;
  }
  if (((_b = params.response_format) == null ? void 0 : _b.type) === "json_schema") {
    if ("$parseRaw" in params.response_format) {
      const response_format = params.response_format;
      return response_format.$parseRaw(content);
    }
    return JSON.parse(content);
  }
  return null;
}
function parseToolCall(params, toolCall) {
  var _a3;
  const inputTool = (_a3 = params.tools) == null ? void 0 : _a3.find((inputTool2) => {
    var _a4;
    return isChatCompletionFunctionTool(inputTool2) && ((_a4 = inputTool2.function) == null ? void 0 : _a4.name) === toolCall.function.name;
  });
  return {
    ...toolCall,
    function: {
      ...toolCall.function,
      parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCall.function.arguments) : (inputTool == null ? void 0 : inputTool.function.strict) ? JSON.parse(toolCall.function.arguments) : null
    }
  };
}
function shouldParseToolCall(params, toolCall) {
  var _a3;
  if (!params || !("tools" in params) || !params.tools) {
    return false;
  }
  const inputTool = (_a3 = params.tools) == null ? void 0 : _a3.find((inputTool2) => {
    var _a4;
    return isChatCompletionFunctionTool(inputTool2) && ((_a4 = inputTool2.function) == null ? void 0 : _a4.name) === toolCall.function.name;
  });
  return isChatCompletionFunctionTool(inputTool) && (isAutoParsableTool(inputTool) || (inputTool == null ? void 0 : inputTool.function.strict) || false);
}
function hasAutoParseableInput(params) {
  var _a3;
  if (isAutoParsableResponseFormat(params.response_format)) {
    return true;
  }
  return ((_a3 = params.tools) == null ? void 0 : _a3.some((t) => isAutoParsableTool(t) || t.type === "function" && t.function.strict === true)) ?? false;
}
function assertToolCallsAreChatCompletionFunctionToolCalls(toolCalls) {
  for (const toolCall of toolCalls || []) {
    if (toolCall.type !== "function") {
      throw new OpenAIError(`Currently only \`function\` tool calls are supported; Received \`${toolCall.type}\``);
    }
  }
}
function validateInputTools(tools) {
  for (const tool of tools ?? []) {
    if (tool.type !== "function") {
      throw new OpenAIError(`Currently only \`function\` tool types support auto-parsing; Received \`${tool.type}\``);
    }
    if (tool.function.strict !== true) {
      throw new OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
    }
  }
}

// node_modules/openai/lib/chatCompletionUtils.mjs
init_cjs_shims();
var isAssistantMessage = (message) => {
  return (message == null ? void 0 : message.role) === "assistant";
};
var isToolMessage = (message) => {
  return (message == null ? void 0 : message.role) === "tool";
};

// node_modules/openai/lib/EventStream.mjs
init_cjs_shims();
var _EventStream_instances;
var _EventStream_connectedPromise;
var _EventStream_resolveConnectedPromise;
var _EventStream_rejectConnectedPromise;
var _EventStream_endPromise;
var _EventStream_resolveEndPromise;
var _EventStream_rejectEndPromise;
var _EventStream_listeners;
var _EventStream_ended;
var _EventStream_errored;
var _EventStream_aborted;
var _EventStream_catchingPromiseCreated;
var _EventStream_handleError;
var EventStream = class {
  constructor() {
    _EventStream_instances.add(this);
    this.controller = new AbortController();
    _EventStream_connectedPromise.set(this, void 0);
    _EventStream_resolveConnectedPromise.set(this, () => {
    });
    _EventStream_rejectConnectedPromise.set(this, () => {
    });
    _EventStream_endPromise.set(this, void 0);
    _EventStream_resolveEndPromise.set(this, () => {
    });
    _EventStream_rejectEndPromise.set(this, () => {
    });
    _EventStream_listeners.set(this, {});
    _EventStream_ended.set(this, false);
    _EventStream_errored.set(this, false);
    _EventStream_aborted.set(this, false);
    _EventStream_catchingPromiseCreated.set(this, false);
    __classPrivateFieldSet(this, _EventStream_connectedPromise, new Promise((resolve, reject) => {
      __classPrivateFieldSet(this, _EventStream_resolveConnectedPromise, resolve, "f");
      __classPrivateFieldSet(this, _EventStream_rejectConnectedPromise, reject, "f");
    }), "f");
    __classPrivateFieldSet(this, _EventStream_endPromise, new Promise((resolve, reject) => {
      __classPrivateFieldSet(this, _EventStream_resolveEndPromise, resolve, "f");
      __classPrivateFieldSet(this, _EventStream_rejectEndPromise, reject, "f");
    }), "f");
    __classPrivateFieldGet(this, _EventStream_connectedPromise, "f").catch(() => {
    });
    __classPrivateFieldGet(this, _EventStream_endPromise, "f").catch(() => {
    });
  }
  _run(executor) {
    setTimeout(() => {
      executor().then(() => {
        this._emitFinal();
        this._emit("end");
      }, __classPrivateFieldGet(this, _EventStream_instances, "m", _EventStream_handleError).bind(this));
    }, 0);
  }
  _connected() {
    if (this.ended)
      return;
    __classPrivateFieldGet(this, _EventStream_resolveConnectedPromise, "f").call(this);
    this._emit("connect");
  }
  get ended() {
    return __classPrivateFieldGet(this, _EventStream_ended, "f");
  }
  get errored() {
    return __classPrivateFieldGet(this, _EventStream_errored, "f");
  }
  get aborted() {
    return __classPrivateFieldGet(this, _EventStream_aborted, "f");
  }
  abort() {
    this.controller.abort();
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  on(event, listener) {
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
    listeners.push({ listener });
    return this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  off(event, listener) {
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
    if (!listeners)
      return this;
    const index = listeners.findIndex((l) => l.listener === listener);
    if (index >= 0)
      listeners.splice(index, 1);
    return this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  once(event, listener) {
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
    listeners.push({ listener, once: true });
    return this;
  }
  /**
   * This is similar to `.once()`, but returns a Promise that resolves the next time
   * the event is triggered, instead of calling a listener callback.
   * @returns a Promise that resolves the next time given event is triggered,
   * or rejects if an error is emitted.  (If you request the 'error' event,
   * returns a promise that resolves with the error).
   *
   * Example:
   *
   *   const message = await stream.emitted('message') // rejects if the stream errors
   */
  emitted(event) {
    return new Promise((resolve, reject) => {
      __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
      if (event !== "error")
        this.once("error", reject);
      this.once(event, resolve);
    });
  }
  async done() {
    __classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
    await __classPrivateFieldGet(this, _EventStream_endPromise, "f");
  }
  _emit(event, ...args) {
    if (__classPrivateFieldGet(this, _EventStream_ended, "f")) {
      return;
    }
    if (event === "end") {
      __classPrivateFieldSet(this, _EventStream_ended, true, "f");
      __classPrivateFieldGet(this, _EventStream_resolveEndPromise, "f").call(this);
    }
    const listeners = __classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
    if (listeners) {
      __classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
      listeners.forEach(({ listener }) => listener(...args));
    }
    if (event === "abort") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !(listeners == null ? void 0 : listeners.length)) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
      return;
    }
    if (event === "error") {
      const error = args[0];
      if (!__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !(listeners == null ? void 0 : listeners.length)) {
        Promise.reject(error);
      }
      __classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
      __classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
      this._emit("end");
    }
  }
  _emitFinal() {
  }
};
_EventStream_connectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_resolveConnectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_rejectConnectedPromise = /* @__PURE__ */ new WeakMap(), _EventStream_endPromise = /* @__PURE__ */ new WeakMap(), _EventStream_resolveEndPromise = /* @__PURE__ */ new WeakMap(), _EventStream_rejectEndPromise = /* @__PURE__ */ new WeakMap(), _EventStream_listeners = /* @__PURE__ */ new WeakMap(), _EventStream_ended = /* @__PURE__ */ new WeakMap(), _EventStream_errored = /* @__PURE__ */ new WeakMap(), _EventStream_aborted = /* @__PURE__ */ new WeakMap(), _EventStream_catchingPromiseCreated = /* @__PURE__ */ new WeakMap(), _EventStream_instances = /* @__PURE__ */ new WeakSet(), _EventStream_handleError = function _EventStream_handleError2(error) {
  __classPrivateFieldSet(this, _EventStream_errored, true, "f");
  if (error instanceof Error && error.name === "AbortError") {
    error = new APIUserAbortError();
  }
  if (error instanceof APIUserAbortError) {
    __classPrivateFieldSet(this, _EventStream_aborted, true, "f");
    return this._emit("abort", error);
  }
  if (error instanceof OpenAIError) {
    return this._emit("error", error);
  }
  if (error instanceof Error) {
    const openAIError = new OpenAIError(error.message);
    openAIError.cause = error;
    return this._emit("error", openAIError);
  }
  return this._emit("error", new OpenAIError(String(error)));
};

// node_modules/openai/lib/RunnableFunction.mjs
init_cjs_shims();
function isRunnableFunctionWithParse(fn) {
  return typeof fn.parse === "function";
}

// node_modules/openai/lib/AbstractChatCompletionRunner.mjs
var _AbstractChatCompletionRunner_instances;
var _AbstractChatCompletionRunner_getFinalContent;
var _AbstractChatCompletionRunner_getFinalMessage;
var _AbstractChatCompletionRunner_getFinalFunctionToolCall;
var _AbstractChatCompletionRunner_getFinalFunctionToolCallResult;
var _AbstractChatCompletionRunner_calculateTotalUsage;
var _AbstractChatCompletionRunner_validateParams;
var _AbstractChatCompletionRunner_stringifyFunctionCallResult;
var DEFAULT_MAX_CHAT_COMPLETIONS = 10;
var AbstractChatCompletionRunner = class extends EventStream {
  constructor() {
    super(...arguments);
    _AbstractChatCompletionRunner_instances.add(this);
    this._chatCompletions = [];
    this.messages = [];
  }
  _addChatCompletion(chatCompletion) {
    var _a3;
    this._chatCompletions.push(chatCompletion);
    this._emit("chatCompletion", chatCompletion);
    const message = (_a3 = chatCompletion.choices[0]) == null ? void 0 : _a3.message;
    if (message)
      this._addMessage(message);
    return chatCompletion;
  }
  _addMessage(message, emit = true) {
    if (!("content" in message))
      message.content = null;
    this.messages.push(message);
    if (emit) {
      this._emit("message", message);
      if (isToolMessage(message) && message.content) {
        this._emit("functionToolCallResult", message.content);
      } else if (isAssistantMessage(message) && message.tool_calls) {
        for (const tool_call of message.tool_calls) {
          if (tool_call.type === "function") {
            this._emit("functionToolCall", tool_call.function);
          }
        }
      }
    }
  }
  /**
   * @returns a promise that resolves with the final ChatCompletion, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
   */
  async finalChatCompletion() {
    await this.done();
    const completion = this._chatCompletions[this._chatCompletions.length - 1];
    if (!completion)
      throw new OpenAIError("stream ended without producing a ChatCompletion");
    return completion;
  }
  /**
   * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalContent() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
  }
  /**
   * @returns a promise that resolves with the the final assistant ChatCompletionMessage response,
   * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalMessage() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
  }
  /**
   * @returns a promise that resolves with the content of the final FunctionCall, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalFunctionToolCall() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
  }
  async finalFunctionToolCallResult() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
  }
  async totalUsage() {
    await this.done();
    return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this);
  }
  allChatCompletions() {
    return [...this._chatCompletions];
  }
  _emitFinal() {
    const completion = this._chatCompletions[this._chatCompletions.length - 1];
    if (completion)
      this._emit("finalChatCompletion", completion);
    const finalMessage = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
    if (finalMessage)
      this._emit("finalMessage", finalMessage);
    const finalContent = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
    if (finalContent)
      this._emit("finalContent", finalContent);
    const finalFunctionCall = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
    if (finalFunctionCall)
      this._emit("finalFunctionToolCall", finalFunctionCall);
    const finalFunctionCallResult = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
    if (finalFunctionCallResult != null)
      this._emit("finalFunctionToolCallResult", finalFunctionCallResult);
    if (this._chatCompletions.some((c) => c.usage)) {
      this._emit("totalUsage", __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this));
    }
  }
  async _createChatCompletion(client, params, options) {
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_validateParams).call(this, params);
    const chatCompletion = await client.chat.completions.create({ ...params, stream: false }, { ...options, signal: this.controller.signal });
    this._connected();
    return this._addChatCompletion(parseChatCompletion(chatCompletion, params));
  }
  async _runChatCompletion(client, params, options) {
    for (const message of params.messages) {
      this._addMessage(message, false);
    }
    return await this._createChatCompletion(client, params, options);
  }
  async _runTools(client, params, options) {
    var _a3, _b, _c;
    const role = "tool";
    const { tool_choice = "auto", stream, ...restParams } = params;
    const singleFunctionToCall = typeof tool_choice !== "string" && tool_choice.type === "function" && ((_a3 = tool_choice == null ? void 0 : tool_choice.function) == null ? void 0 : _a3.name);
    const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options || {};
    const inputTools = params.tools.map((tool) => {
      if (isAutoParsableTool(tool)) {
        if (!tool.$callback) {
          throw new OpenAIError("Tool given to `.runTools()` that does not have an associated function");
        }
        return {
          type: "function",
          function: {
            function: tool.$callback,
            name: tool.function.name,
            description: tool.function.description || "",
            parameters: tool.function.parameters,
            parse: tool.$parseRaw,
            strict: true
          }
        };
      }
      return tool;
    });
    const functionsByName = {};
    for (const f of inputTools) {
      if (f.type === "function") {
        functionsByName[f.function.name || f.function.function.name] = f.function;
      }
    }
    const tools = "tools" in params ? inputTools.map((t) => t.type === "function" ? {
      type: "function",
      function: {
        name: t.function.name || t.function.function.name,
        parameters: t.function.parameters,
        description: t.function.description,
        strict: t.function.strict
      }
    } : t) : void 0;
    for (const message of params.messages) {
      this._addMessage(message, false);
    }
    for (let i = 0; i < maxChatCompletions; ++i) {
      const chatCompletion = await this._createChatCompletion(client, {
        ...restParams,
        tool_choice,
        tools,
        messages: [...this.messages]
      }, options);
      const message = (_b = chatCompletion.choices[0]) == null ? void 0 : _b.message;
      if (!message) {
        throw new OpenAIError(`missing message in ChatCompletion response`);
      }
      if (!((_c = message.tool_calls) == null ? void 0 : _c.length)) {
        return;
      }
      for (const tool_call of message.tool_calls) {
        if (tool_call.type !== "function")
          continue;
        const tool_call_id = tool_call.id;
        const { name, arguments: args } = tool_call.function;
        const fn = functionsByName[name];
        if (!fn) {
          const content2 = `Invalid tool_call: ${JSON.stringify(name)}. Available options are: ${Object.keys(functionsByName).map((name2) => JSON.stringify(name2)).join(", ")}. Please try again`;
          this._addMessage({ role, tool_call_id, content: content2 });
          continue;
        } else if (singleFunctionToCall && singleFunctionToCall !== name) {
          const content2 = `Invalid tool_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
          this._addMessage({ role, tool_call_id, content: content2 });
          continue;
        }
        let parsed;
        try {
          parsed = isRunnableFunctionWithParse(fn) ? await fn.parse(args) : args;
        } catch (error) {
          const content2 = error instanceof Error ? error.message : String(error);
          this._addMessage({ role, tool_call_id, content: content2 });
          continue;
        }
        const rawContent = await fn.function(parsed, this);
        const content = __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
        this._addMessage({ role, tool_call_id, content });
        if (singleFunctionToCall) {
          return;
        }
      }
    }
    return;
  }
};
_AbstractChatCompletionRunner_instances = /* @__PURE__ */ new WeakSet(), _AbstractChatCompletionRunner_getFinalContent = function _AbstractChatCompletionRunner_getFinalContent2() {
  return __classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this).content ?? null;
}, _AbstractChatCompletionRunner_getFinalMessage = function _AbstractChatCompletionRunner_getFinalMessage2() {
  let i = this.messages.length;
  while (i-- > 0) {
    const message = this.messages[i];
    if (isAssistantMessage(message)) {
      const ret = {
        ...message,
        content: message.content ?? null,
        refusal: message.refusal ?? null
      };
      return ret;
    }
  }
  throw new OpenAIError("stream ended without producing a ChatCompletionMessage with role=assistant");
}, _AbstractChatCompletionRunner_getFinalFunctionToolCall = function _AbstractChatCompletionRunner_getFinalFunctionToolCall2() {
  var _a3, _b;
  for (let i = this.messages.length - 1; i >= 0; i--) {
    const message = this.messages[i];
    if (isAssistantMessage(message) && ((_a3 = message == null ? void 0 : message.tool_calls) == null ? void 0 : _a3.length)) {
      return (_b = message.tool_calls.filter((x) => x.type === "function").at(-1)) == null ? void 0 : _b.function;
    }
  }
  return;
}, _AbstractChatCompletionRunner_getFinalFunctionToolCallResult = function _AbstractChatCompletionRunner_getFinalFunctionToolCallResult2() {
  for (let i = this.messages.length - 1; i >= 0; i--) {
    const message = this.messages[i];
    if (isToolMessage(message) && message.content != null && typeof message.content === "string" && this.messages.some((x) => {
      var _a3;
      return x.role === "assistant" && ((_a3 = x.tool_calls) == null ? void 0 : _a3.some((y) => y.type === "function" && y.id === message.tool_call_id));
    })) {
      return message.content;
    }
  }
  return;
}, _AbstractChatCompletionRunner_calculateTotalUsage = function _AbstractChatCompletionRunner_calculateTotalUsage2() {
  const total = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  };
  for (const { usage } of this._chatCompletions) {
    if (usage) {
      total.completion_tokens += usage.completion_tokens;
      total.prompt_tokens += usage.prompt_tokens;
      total.total_tokens += usage.total_tokens;
    }
  }
  return total;
}, _AbstractChatCompletionRunner_validateParams = function _AbstractChatCompletionRunner_validateParams2(params) {
  if (params.n != null && params.n > 1) {
    throw new OpenAIError("ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.");
  }
}, _AbstractChatCompletionRunner_stringifyFunctionCallResult = function _AbstractChatCompletionRunner_stringifyFunctionCallResult2(rawContent) {
  return typeof rawContent === "string" ? rawContent : rawContent === void 0 ? "undefined" : JSON.stringify(rawContent);
};

// node_modules/openai/lib/ChatCompletionRunner.mjs
var ChatCompletionRunner = class _ChatCompletionRunner extends AbstractChatCompletionRunner {
  static runTools(client, params, options) {
    const runner = new _ChatCompletionRunner();
    const opts = {
      ...options,
      headers: { ...options == null ? void 0 : options.headers, "X-Stainless-Helper-Method": "runTools" }
    };
    runner._run(() => runner._runTools(client, params, opts));
    return runner;
  }
  _addMessage(message, emit = true) {
    super._addMessage(message, emit);
    if (isAssistantMessage(message) && message.content) {
      this._emit("content", message.content);
    }
  }
};

// node_modules/openai/lib/ChatCompletionStreamingRunner.mjs
init_cjs_shims();

// node_modules/openai/lib/ChatCompletionStream.mjs
init_cjs_shims();

// node_modules/openai/_vendor/partial-json-parser/parser.mjs
init_cjs_shims();
var STR = 1;
var NUM = 2;
var ARR = 4;
var OBJ = 8;
var NULL = 16;
var BOOL = 32;
var NAN = 64;
var INFINITY = 128;
var MINUS_INFINITY = 256;
var INF = INFINITY | MINUS_INFINITY;
var SPECIAL = NULL | BOOL | INF | NAN;
var ATOM = STR | NUM | SPECIAL;
var COLLECTION = ARR | OBJ;
var ALL = ATOM | COLLECTION;
var Allow = {
  STR,
  NUM,
  ARR,
  OBJ,
  NULL,
  BOOL,
  NAN,
  INFINITY,
  MINUS_INFINITY,
  INF,
  SPECIAL,
  ATOM,
  COLLECTION,
  ALL
};
var PartialJSON = class extends Error {
};
var MalformedJSON = class extends Error {
};
function parseJSON(jsonString, allowPartial = Allow.ALL) {
  if (typeof jsonString !== "string") {
    throw new TypeError(`expecting str, got ${typeof jsonString}`);
  }
  if (!jsonString.trim()) {
    throw new Error(`${jsonString} is empty`);
  }
  return _parseJSON(jsonString.trim(), allowPartial);
}
var _parseJSON = (jsonString, allow) => {
  const length = jsonString.length;
  let index = 0;
  const markPartialJSON = (msg) => {
    throw new PartialJSON(`${msg} at position ${index}`);
  };
  const throwMalformedError = (msg) => {
    throw new MalformedJSON(`${msg} at position ${index}`);
  };
  const parseAny = () => {
    skipBlank();
    if (index >= length)
      markPartialJSON("Unexpected end of input");
    if (jsonString[index] === '"')
      return parseStr();
    if (jsonString[index] === "{")
      return parseObj();
    if (jsonString[index] === "[")
      return parseArr();
    if (jsonString.substring(index, index + 4) === "null" || Allow.NULL & allow && length - index < 4 && "null".startsWith(jsonString.substring(index))) {
      index += 4;
      return null;
    }
    if (jsonString.substring(index, index + 4) === "true" || Allow.BOOL & allow && length - index < 4 && "true".startsWith(jsonString.substring(index))) {
      index += 4;
      return true;
    }
    if (jsonString.substring(index, index + 5) === "false" || Allow.BOOL & allow && length - index < 5 && "false".startsWith(jsonString.substring(index))) {
      index += 5;
      return false;
    }
    if (jsonString.substring(index, index + 8) === "Infinity" || Allow.INFINITY & allow && length - index < 8 && "Infinity".startsWith(jsonString.substring(index))) {
      index += 8;
      return Infinity;
    }
    if (jsonString.substring(index, index + 9) === "-Infinity" || Allow.MINUS_INFINITY & allow && 1 < length - index && length - index < 9 && "-Infinity".startsWith(jsonString.substring(index))) {
      index += 9;
      return -Infinity;
    }
    if (jsonString.substring(index, index + 3) === "NaN" || Allow.NAN & allow && length - index < 3 && "NaN".startsWith(jsonString.substring(index))) {
      index += 3;
      return NaN;
    }
    return parseNum();
  };
  const parseStr = () => {
    const start = index;
    let escape2 = false;
    index++;
    while (index < length && (jsonString[index] !== '"' || escape2 && jsonString[index - 1] === "\\")) {
      escape2 = jsonString[index] === "\\" ? !escape2 : false;
      index++;
    }
    if (jsonString.charAt(index) == '"') {
      try {
        return JSON.parse(jsonString.substring(start, ++index - Number(escape2)));
      } catch (e) {
        throwMalformedError(String(e));
      }
    } else if (Allow.STR & allow) {
      try {
        return JSON.parse(jsonString.substring(start, index - Number(escape2)) + '"');
      } catch (e) {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("\\")) + '"');
      }
    }
    markPartialJSON("Unterminated string literal");
  };
  const parseObj = () => {
    index++;
    skipBlank();
    const obj = {};
    try {
      while (jsonString[index] !== "}") {
        skipBlank();
        if (index >= length && Allow.OBJ & allow)
          return obj;
        const key = parseStr();
        skipBlank();
        index++;
        try {
          const value = parseAny();
          Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
        } catch (e) {
          if (Allow.OBJ & allow)
            return obj;
          else
            throw e;
        }
        skipBlank();
        if (jsonString[index] === ",")
          index++;
      }
    } catch (e) {
      if (Allow.OBJ & allow)
        return obj;
      else
        markPartialJSON("Expected '}' at end of object");
    }
    index++;
    return obj;
  };
  const parseArr = () => {
    index++;
    const arr = [];
    try {
      while (jsonString[index] !== "]") {
        arr.push(parseAny());
        skipBlank();
        if (jsonString[index] === ",") {
          index++;
        }
      }
    } catch (e) {
      if (Allow.ARR & allow) {
        return arr;
      }
      markPartialJSON("Expected ']' at end of array");
    }
    index++;
    return arr;
  };
  const parseNum = () => {
    if (index === 0) {
      if (jsonString === "-" && Allow.NUM & allow)
        markPartialJSON("Not sure what '-' is");
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        if (Allow.NUM & allow) {
          try {
            if ("." === jsonString[jsonString.length - 1])
              return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf(".")));
            return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf("e")));
          } catch (e2) {
          }
        }
        throwMalformedError(String(e));
      }
    }
    const start = index;
    if (jsonString[index] === "-")
      index++;
    while (jsonString[index] && !",]}".includes(jsonString[index]))
      index++;
    if (index == length && !(Allow.NUM & allow))
      markPartialJSON("Unterminated number literal");
    try {
      return JSON.parse(jsonString.substring(start, index));
    } catch (e) {
      if (jsonString.substring(start, index) === "-" && Allow.NUM & allow)
        markPartialJSON("Not sure what '-' is");
      try {
        return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf("e")));
      } catch (e2) {
        throwMalformedError(String(e2));
      }
    }
  };
  const skipBlank = () => {
    while (index < length && " \n\r	".includes(jsonString[index])) {
      index++;
    }
  };
  return parseAny();
};
var partialParse = (input) => parseJSON(input, Allow.ALL ^ Allow.NUM);

// node_modules/openai/streaming.mjs
init_cjs_shims();

// node_modules/openai/lib/ChatCompletionStream.mjs
var _ChatCompletionStream_instances;
var _ChatCompletionStream_params;
var _ChatCompletionStream_choiceEventStates;
var _ChatCompletionStream_currentChatCompletionSnapshot;
var _ChatCompletionStream_beginRequest;
var _ChatCompletionStream_getChoiceEventState;
var _ChatCompletionStream_addChunk;
var _ChatCompletionStream_emitToolCallDoneEvent;
var _ChatCompletionStream_emitContentDoneEvents;
var _ChatCompletionStream_endRequest;
var _ChatCompletionStream_getAutoParseableResponseFormat;
var _ChatCompletionStream_accumulateChatCompletion;
var ChatCompletionStream = class _ChatCompletionStream extends AbstractChatCompletionRunner {
  constructor(params) {
    super();
    _ChatCompletionStream_instances.add(this);
    _ChatCompletionStream_params.set(this, void 0);
    _ChatCompletionStream_choiceEventStates.set(this, void 0);
    _ChatCompletionStream_currentChatCompletionSnapshot.set(this, void 0);
    __classPrivateFieldSet(this, _ChatCompletionStream_params, params, "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
  }
  get currentChatCompletionSnapshot() {
    return __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Note that messages sent to the model do not appear in `.on('message')`
   * in this context.
   */
  static fromReadableStream(stream) {
    const runner = new _ChatCompletionStream(null);
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  static createChatCompletion(client, params, options) {
    const runner = new _ChatCompletionStream(params);
    runner._run(() => runner._runChatCompletion(client, { ...params, stream: true }, { ...options, headers: { ...options == null ? void 0 : options.headers, "X-Stainless-Helper-Method": "stream" } }));
    return runner;
  }
  async _createChatCompletion(client, params, options) {
    var _a3;
    super._createChatCompletion;
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
    const stream = await client.chat.completions.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
    this._connected();
    for await (const chunk of stream) {
      __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
    }
    if ((_a3 = stream.controller.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
  }
  async _fromReadableStream(readableStream, options) {
    var _a3;
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
    this._connected();
    const stream = Stream.fromReadableStream(readableStream, this.controller);
    let chatId;
    for await (const chunk of stream) {
      if (chatId && chatId !== chunk.id) {
        this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
      }
      __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
      chatId = chunk.id;
    }
    if ((_a3 = stream.controller.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    return this._addChatCompletion(__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
  }
  [(_ChatCompletionStream_params = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_choiceEventStates = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_currentChatCompletionSnapshot = /* @__PURE__ */ new WeakMap(), _ChatCompletionStream_instances = /* @__PURE__ */ new WeakSet(), _ChatCompletionStream_beginRequest = function _ChatCompletionStream_beginRequest2() {
    if (this.ended)
      return;
    __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, void 0, "f");
  }, _ChatCompletionStream_getChoiceEventState = function _ChatCompletionStream_getChoiceEventState2(choice) {
    let state = __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index];
    if (state) {
      return state;
    }
    state = {
      content_done: false,
      refusal_done: false,
      logprobs_content_done: false,
      logprobs_refusal_done: false,
      done_tool_calls: /* @__PURE__ */ new Set(),
      current_tool_call_index: null
    };
    __classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index] = state;
    return state;
  }, _ChatCompletionStream_addChunk = function _ChatCompletionStream_addChunk2(chunk) {
    var _a3, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    if (this.ended)
      return;
    const completion = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_accumulateChatCompletion).call(this, chunk);
    this._emit("chunk", chunk, completion);
    for (const choice of chunk.choices) {
      const choiceSnapshot = completion.choices[choice.index];
      if (choice.delta.content != null && ((_a3 = choiceSnapshot.message) == null ? void 0 : _a3.role) === "assistant" && ((_b = choiceSnapshot.message) == null ? void 0 : _b.content)) {
        this._emit("content", choice.delta.content, choiceSnapshot.message.content);
        this._emit("content.delta", {
          delta: choice.delta.content,
          snapshot: choiceSnapshot.message.content,
          parsed: choiceSnapshot.message.parsed
        });
      }
      if (choice.delta.refusal != null && ((_c = choiceSnapshot.message) == null ? void 0 : _c.role) === "assistant" && ((_d = choiceSnapshot.message) == null ? void 0 : _d.refusal)) {
        this._emit("refusal.delta", {
          delta: choice.delta.refusal,
          snapshot: choiceSnapshot.message.refusal
        });
      }
      if (((_e = choice.logprobs) == null ? void 0 : _e.content) != null && ((_f = choiceSnapshot.message) == null ? void 0 : _f.role) === "assistant") {
        this._emit("logprobs.content.delta", {
          content: (_g = choice.logprobs) == null ? void 0 : _g.content,
          snapshot: ((_h = choiceSnapshot.logprobs) == null ? void 0 : _h.content) ?? []
        });
      }
      if (((_i = choice.logprobs) == null ? void 0 : _i.refusal) != null && ((_j = choiceSnapshot.message) == null ? void 0 : _j.role) === "assistant") {
        this._emit("logprobs.refusal.delta", {
          refusal: (_k = choice.logprobs) == null ? void 0 : _k.refusal,
          snapshot: ((_l = choiceSnapshot.logprobs) == null ? void 0 : _l.refusal) ?? []
        });
      }
      const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
      if (choiceSnapshot.finish_reason) {
        __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
        if (state.current_tool_call_index != null) {
          __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
        }
      }
      for (const toolCall of choice.delta.tool_calls ?? []) {
        if (state.current_tool_call_index !== toolCall.index) {
          __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
          if (state.current_tool_call_index != null) {
            __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
          }
        }
        state.current_tool_call_index = toolCall.index;
      }
      for (const toolCallDelta of choice.delta.tool_calls ?? []) {
        const toolCallSnapshot = (_m = choiceSnapshot.message.tool_calls) == null ? void 0 : _m[toolCallDelta.index];
        if (!(toolCallSnapshot == null ? void 0 : toolCallSnapshot.type)) {
          continue;
        }
        if ((toolCallSnapshot == null ? void 0 : toolCallSnapshot.type) === "function") {
          this._emit("tool_calls.function.arguments.delta", {
            name: (_n = toolCallSnapshot.function) == null ? void 0 : _n.name,
            index: toolCallDelta.index,
            arguments: toolCallSnapshot.function.arguments,
            parsed_arguments: toolCallSnapshot.function.parsed_arguments,
            arguments_delta: ((_o = toolCallDelta.function) == null ? void 0 : _o.arguments) ?? ""
          });
        } else {
          assertNever(toolCallSnapshot == null ? void 0 : toolCallSnapshot.type);
        }
      }
    }
  }, _ChatCompletionStream_emitToolCallDoneEvent = function _ChatCompletionStream_emitToolCallDoneEvent2(choiceSnapshot, toolCallIndex) {
    var _a3, _b, _c;
    const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
    if (state.done_tool_calls.has(toolCallIndex)) {
      return;
    }
    const toolCallSnapshot = (_a3 = choiceSnapshot.message.tool_calls) == null ? void 0 : _a3[toolCallIndex];
    if (!toolCallSnapshot) {
      throw new Error("no tool call snapshot");
    }
    if (!toolCallSnapshot.type) {
      throw new Error("tool call snapshot missing `type`");
    }
    if (toolCallSnapshot.type === "function") {
      const inputTool = (_c = (_b = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")) == null ? void 0 : _b.tools) == null ? void 0 : _c.find((tool) => isChatCompletionFunctionTool(tool) && tool.function.name === toolCallSnapshot.function.name);
      this._emit("tool_calls.function.arguments.done", {
        name: toolCallSnapshot.function.name,
        index: toolCallIndex,
        arguments: toolCallSnapshot.function.arguments,
        parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCallSnapshot.function.arguments) : (inputTool == null ? void 0 : inputTool.function.strict) ? JSON.parse(toolCallSnapshot.function.arguments) : null
      });
    } else {
      assertNever(toolCallSnapshot.type);
    }
  }, _ChatCompletionStream_emitContentDoneEvents = function _ChatCompletionStream_emitContentDoneEvents2(choiceSnapshot) {
    var _a3, _b;
    const state = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
    if (choiceSnapshot.message.content && !state.content_done) {
      state.content_done = true;
      const responseFormat = __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this);
      this._emit("content.done", {
        content: choiceSnapshot.message.content,
        parsed: responseFormat ? responseFormat.$parseRaw(choiceSnapshot.message.content) : null
      });
    }
    if (choiceSnapshot.message.refusal && !state.refusal_done) {
      state.refusal_done = true;
      this._emit("refusal.done", { refusal: choiceSnapshot.message.refusal });
    }
    if (((_a3 = choiceSnapshot.logprobs) == null ? void 0 : _a3.content) && !state.logprobs_content_done) {
      state.logprobs_content_done = true;
      this._emit("logprobs.content.done", { content: choiceSnapshot.logprobs.content });
    }
    if (((_b = choiceSnapshot.logprobs) == null ? void 0 : _b.refusal) && !state.logprobs_refusal_done) {
      state.logprobs_refusal_done = true;
      this._emit("logprobs.refusal.done", { refusal: choiceSnapshot.logprobs.refusal });
    }
  }, _ChatCompletionStream_endRequest = function _ChatCompletionStream_endRequest2() {
    if (this.ended) {
      throw new OpenAIError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    if (!snapshot) {
      throw new OpenAIError(`request ended without sending any chunks`);
    }
    __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, void 0, "f");
    __classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
    return finalizeChatCompletion(snapshot, __classPrivateFieldGet(this, _ChatCompletionStream_params, "f"));
  }, _ChatCompletionStream_getAutoParseableResponseFormat = function _ChatCompletionStream_getAutoParseableResponseFormat2() {
    var _a3;
    const responseFormat = (_a3 = __classPrivateFieldGet(this, _ChatCompletionStream_params, "f")) == null ? void 0 : _a3.response_format;
    if (isAutoParsableResponseFormat(responseFormat)) {
      return responseFormat;
    }
    return null;
  }, _ChatCompletionStream_accumulateChatCompletion = function _ChatCompletionStream_accumulateChatCompletion2(chunk) {
    var _a3, _b, _c, _d;
    let snapshot = __classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    const { choices, ...rest } = chunk;
    if (!snapshot) {
      snapshot = __classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, {
        ...rest,
        choices: []
      }, "f");
    } else {
      Object.assign(snapshot, rest);
    }
    for (const { delta, finish_reason, index, logprobs = null, ...other } of chunk.choices) {
      let choice = snapshot.choices[index];
      if (!choice) {
        choice = snapshot.choices[index] = { finish_reason, index, message: {}, logprobs, ...other };
      }
      if (logprobs) {
        if (!choice.logprobs) {
          choice.logprobs = Object.assign({}, logprobs);
        } else {
          const { content: content2, refusal: refusal2, ...rest3 } = logprobs;
          assertIsEmpty(rest3);
          Object.assign(choice.logprobs, rest3);
          if (content2) {
            (_a3 = choice.logprobs).content ?? (_a3.content = []);
            choice.logprobs.content.push(...content2);
          }
          if (refusal2) {
            (_b = choice.logprobs).refusal ?? (_b.refusal = []);
            choice.logprobs.refusal.push(...refusal2);
          }
        }
      }
      if (finish_reason) {
        choice.finish_reason = finish_reason;
        if (__classPrivateFieldGet(this, _ChatCompletionStream_params, "f") && hasAutoParseableInput(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"))) {
          if (finish_reason === "length") {
            throw new LengthFinishReasonError();
          }
          if (finish_reason === "content_filter") {
            throw new ContentFilterFinishReasonError();
          }
        }
      }
      Object.assign(choice, other);
      if (!delta)
        continue;
      const { content, refusal, function_call, role, tool_calls, ...rest2 } = delta;
      assertIsEmpty(rest2);
      Object.assign(choice.message, rest2);
      if (refusal) {
        choice.message.refusal = (choice.message.refusal || "") + refusal;
      }
      if (role)
        choice.message.role = role;
      if (function_call) {
        if (!choice.message.function_call) {
          choice.message.function_call = function_call;
        } else {
          if (function_call.name)
            choice.message.function_call.name = function_call.name;
          if (function_call.arguments) {
            (_c = choice.message.function_call).arguments ?? (_c.arguments = "");
            choice.message.function_call.arguments += function_call.arguments;
          }
        }
      }
      if (content) {
        choice.message.content = (choice.message.content || "") + content;
        if (!choice.message.refusal && __classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this)) {
          choice.message.parsed = partialParse(choice.message.content);
        }
      }
      if (tool_calls) {
        if (!choice.message.tool_calls)
          choice.message.tool_calls = [];
        for (const { index: index2, id, type, function: fn, ...rest3 } of tool_calls) {
          const tool_call = (_d = choice.message.tool_calls)[index2] ?? (_d[index2] = {});
          Object.assign(tool_call, rest3);
          if (id)
            tool_call.id = id;
          if (type)
            tool_call.type = type;
          if (fn)
            tool_call.function ?? (tool_call.function = { name: fn.name ?? "", arguments: "" });
          if (fn == null ? void 0 : fn.name)
            tool_call.function.name = fn.name;
          if (fn == null ? void 0 : fn.arguments) {
            tool_call.function.arguments += fn.arguments;
            if (shouldParseToolCall(__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"), tool_call)) {
              tool_call.function.parsed_arguments = partialParse(tool_call.function.arguments);
            }
          }
        }
      }
    }
    return snapshot;
  }, Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("chunk", (chunk) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(chunk);
      } else {
        pushQueue.push(chunk);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: void 0, done: true });
        }
        const chunk = pushQueue.shift();
        return { value: chunk, done: false };
      },
      return: async () => {
        this.abort();
        return { value: void 0, done: true };
      }
    };
  }
  toReadableStream() {
    const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream.toReadableStream();
  }
};
function finalizeChatCompletion(snapshot, params) {
  const { id, choices, created, model, system_fingerprint, ...rest } = snapshot;
  const completion = {
    ...rest,
    id,
    choices: choices.map(({ message, finish_reason, index, logprobs, ...choiceRest }) => {
      if (!finish_reason) {
        throw new OpenAIError(`missing finish_reason for choice ${index}`);
      }
      const { content = null, function_call, tool_calls, ...messageRest } = message;
      const role = message.role;
      if (!role) {
        throw new OpenAIError(`missing role for choice ${index}`);
      }
      if (function_call) {
        const { arguments: args, name } = function_call;
        if (args == null) {
          throw new OpenAIError(`missing function_call.arguments for choice ${index}`);
        }
        if (!name) {
          throw new OpenAIError(`missing function_call.name for choice ${index}`);
        }
        return {
          ...choiceRest,
          message: {
            content,
            function_call: { arguments: args, name },
            role,
            refusal: message.refusal ?? null
          },
          finish_reason,
          index,
          logprobs
        };
      }
      if (tool_calls) {
        return {
          ...choiceRest,
          index,
          finish_reason,
          logprobs,
          message: {
            ...messageRest,
            role,
            content,
            refusal: message.refusal ?? null,
            tool_calls: tool_calls.map((tool_call, i) => {
              const { function: fn, type, id: id2, ...toolRest } = tool_call;
              const { arguments: args, name, ...fnRest } = fn || {};
              if (id2 == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].id
${str(snapshot)}`);
              }
              if (type == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].type
${str(snapshot)}`);
              }
              if (name == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.name
${str(snapshot)}`);
              }
              if (args == null) {
                throw new OpenAIError(`missing choices[${index}].tool_calls[${i}].function.arguments
${str(snapshot)}`);
              }
              return { ...toolRest, id: id2, type, function: { ...fnRest, name, arguments: args } };
            })
          }
        };
      }
      return {
        ...choiceRest,
        message: { ...messageRest, content, role, refusal: message.refusal ?? null },
        finish_reason,
        index,
        logprobs
      };
    }),
    created,
    model,
    object: "chat.completion",
    ...system_fingerprint ? { system_fingerprint } : {}
  };
  return maybeParseChatCompletion(completion, params);
}
function str(x) {
  return JSON.stringify(x);
}
function assertIsEmpty(obj) {
  return;
}
function assertNever(_x) {
}

// node_modules/openai/lib/ChatCompletionStreamingRunner.mjs
var ChatCompletionStreamingRunner = class _ChatCompletionStreamingRunner extends ChatCompletionStream {
  static fromReadableStream(stream) {
    const runner = new _ChatCompletionStreamingRunner(null);
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  static runTools(client, params, options) {
    const runner = new _ChatCompletionStreamingRunner(
      // @ts-expect-error TODO these types are incompatible
      params
    );
    const opts = {
      ...options,
      headers: { ...options == null ? void 0 : options.headers, "X-Stainless-Helper-Method": "runTools" }
    };
    runner._run(() => runner._runTools(client, params, opts));
    return runner;
  }
};

// node_modules/openai/resources/chat/completions/completions.mjs
var Completions = class extends APIResource {
  constructor() {
    super(...arguments);
    this.messages = new Messages(this._client);
  }
  create(body, options) {
    return this._client.post("/chat/completions", { body, ...options, stream: body.stream ?? false });
  }
  /**
   * Get a stored chat completion. Only Chat Completions that have been created with
   * the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * const chatCompletion =
   *   await client.chat.completions.retrieve('completion_id');
   * ```
   */
  retrieve(completionID, options) {
    return this._client.get(path5`/chat/completions/${completionID}`, options);
  }
  /**
   * Modify a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be modified. Currently, the only
   * supported modification is to update the `metadata` field.
   *
   * @example
   * ```ts
   * const chatCompletion = await client.chat.completions.update(
   *   'completion_id',
   *   { metadata: { foo: 'string' } },
   * );
   * ```
   */
  update(completionID, body, options) {
    return this._client.post(path5`/chat/completions/${completionID}`, { body, ...options });
  }
  /**
   * List stored Chat Completions. Only Chat Completions that have been stored with
   * the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatCompletion of client.chat.completions.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/chat/completions", CursorPage, { query, ...options });
  }
  /**
   * Delete a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be deleted.
   *
   * @example
   * ```ts
   * const chatCompletionDeleted =
   *   await client.chat.completions.delete('completion_id');
   * ```
   */
  delete(completionID, options) {
    return this._client.delete(path5`/chat/completions/${completionID}`, options);
  }
  parse(body, options) {
    validateInputTools(body.tools);
    return this._client.chat.completions.create(body, {
      ...options,
      headers: {
        ...options == null ? void 0 : options.headers,
        "X-Stainless-Helper-Method": "chat.completions.parse"
      }
    })._thenUnwrap((completion) => parseChatCompletion(completion, body));
  }
  runTools(body, options) {
    if (body.stream) {
      return ChatCompletionStreamingRunner.runTools(this._client, body, options);
    }
    return ChatCompletionRunner.runTools(this._client, body, options);
  }
  /**
   * Creates a chat completion stream
   */
  stream(body, options) {
    return ChatCompletionStream.createChatCompletion(this._client, body, options);
  }
};
Completions.Messages = Messages;

// node_modules/openai/resources/chat/chat.mjs
var Chat = class extends APIResource {
  constructor() {
    super(...arguments);
    this.completions = new Completions(this._client);
  }
};
Chat.Completions = Completions;

// node_modules/openai/resources/chat/completions/index.mjs
init_cjs_shims();

// node_modules/openai/resources/shared.mjs
init_cjs_shims();

// node_modules/openai/resources/audio/audio.mjs
init_cjs_shims();

// node_modules/openai/resources/audio/speech.mjs
init_cjs_shims();

// node_modules/openai/internal/headers.mjs
init_cjs_shims();
var brand_privateNullableHeaders = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* iterateHeaders(headers) {
  if (!headers)
    return;
  if (brand_privateNullableHeaders in headers) {
    const { values, nulls } = headers;
    yield* values.entries();
    for (const name of nulls) {
      yield [name, null];
    }
    return;
  }
  let shouldClear = false;
  let iter;
  if (headers instanceof Headers) {
    iter = headers.entries();
  } else if (isReadonlyArray(headers)) {
    iter = headers;
  } else {
    shouldClear = true;
    iter = Object.entries(headers ?? {});
  }
  for (let row of iter) {
    const name = row[0];
    if (typeof name !== "string")
      throw new TypeError("expected header name to be a string");
    const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
    let didClear = false;
    for (const value of values) {
      if (value === void 0)
        continue;
      if (shouldClear && !didClear) {
        didClear = true;
        yield [name, null];
      }
      yield [name, value];
    }
  }
}
var buildHeaders = (newHeaders) => {
  const targetHeaders = new Headers();
  const nullHeaders = /* @__PURE__ */ new Set();
  for (const headers of newHeaders) {
    const seenHeaders = /* @__PURE__ */ new Set();
    for (const [name, value] of iterateHeaders(headers)) {
      const lowerName = name.toLowerCase();
      if (!seenHeaders.has(lowerName)) {
        targetHeaders.delete(name);
        seenHeaders.add(lowerName);
      }
      if (value === null) {
        targetHeaders.delete(name);
        nullHeaders.add(lowerName);
      } else {
        targetHeaders.append(name, value);
        nullHeaders.delete(lowerName);
      }
    }
  }
  return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};

// node_modules/openai/resources/audio/speech.mjs
var Speech = class extends APIResource {
  /**
   * Generates audio from the input text.
   *
   * @example
   * ```ts
   * const speech = await client.audio.speech.create({
   *   input: 'input',
   *   model: 'string',
   *   voice: 'ash',
   * });
   *
   * const content = await speech.blob();
   * console.log(content);
   * ```
   */
  create(body, options) {
    return this._client.post("/audio/speech", {
      body,
      ...options,
      headers: buildHeaders([{ Accept: "application/octet-stream" }, options == null ? void 0 : options.headers]),
      __binaryResponse: true
    });
  }
};

// node_modules/openai/resources/audio/transcriptions.mjs
init_cjs_shims();
var Transcriptions = class extends APIResource {
  create(body, options) {
    return this._client.post("/audio/transcriptions", multipartFormRequestOptions({
      body,
      ...options,
      stream: body.stream ?? false,
      __metadata: { model: body.model }
    }, this._client));
  }
};

// node_modules/openai/resources/audio/translations.mjs
init_cjs_shims();
var Translations = class extends APIResource {
  create(body, options) {
    return this._client.post("/audio/translations", multipartFormRequestOptions({ body, ...options, __metadata: { model: body.model } }, this._client));
  }
};

// node_modules/openai/resources/audio/audio.mjs
var Audio = class extends APIResource {
  constructor() {
    super(...arguments);
    this.transcriptions = new Transcriptions(this._client);
    this.translations = new Translations(this._client);
    this.speech = new Speech(this._client);
  }
};
Audio.Transcriptions = Transcriptions;
Audio.Translations = Translations;
Audio.Speech = Speech;

// node_modules/openai/resources/batches.mjs
init_cjs_shims();
var Batches = class extends APIResource {
  /**
   * Creates and executes a batch from an uploaded file of requests
   */
  create(body, options) {
    return this._client.post("/batches", { body, ...options });
  }
  /**
   * Retrieves a batch.
   */
  retrieve(batchID, options) {
    return this._client.get(path5`/batches/${batchID}`, options);
  }
  /**
   * List your organization's batches.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/batches", CursorPage, { query, ...options });
  }
  /**
   * Cancels an in-progress batch. The batch will be in status `cancelling` for up to
   * 10 minutes, before changing to `cancelled`, where it will have partial results
   * (if any) available in the output file.
   */
  cancel(batchID, options) {
    return this._client.post(path5`/batches/${batchID}/cancel`, options);
  }
};

// node_modules/openai/resources/beta/beta.mjs
init_cjs_shims();

// node_modules/openai/resources/beta/assistants.mjs
init_cjs_shims();
var Assistants = class extends APIResource {
  /**
   * Create an assistant with a model and instructions.
   *
   * @example
   * ```ts
   * const assistant = await client.beta.assistants.create({
   *   model: 'gpt-4o',
   * });
   * ```
   */
  create(body, options) {
    return this._client.post("/assistants", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Retrieves an assistant.
   *
   * @example
   * ```ts
   * const assistant = await client.beta.assistants.retrieve(
   *   'assistant_id',
   * );
   * ```
   */
  retrieve(assistantID, options) {
    return this._client.get(path5`/assistants/${assistantID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Modifies an assistant.
   *
   * @example
   * ```ts
   * const assistant = await client.beta.assistants.update(
   *   'assistant_id',
   * );
   * ```
   */
  update(assistantID, body, options) {
    return this._client.post(path5`/assistants/${assistantID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Returns a list of assistants.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const assistant of client.beta.assistants.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/assistants", CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Delete an assistant.
   *
   * @example
   * ```ts
   * const assistantDeleted =
   *   await client.beta.assistants.delete('assistant_id');
   * ```
   */
  delete(assistantID, options) {
    return this._client.delete(path5`/assistants/${assistantID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
};

// node_modules/openai/resources/beta/realtime/realtime.mjs
init_cjs_shims();

// node_modules/openai/resources/beta/realtime/sessions.mjs
init_cjs_shims();
var Sessions = class extends APIResource {
  /**
   * Create an ephemeral API token for use in client-side applications with the
   * Realtime API. Can be configured with the same session parameters as the
   * `session.update` client event.
   *
   * It responds with a session object, plus a `client_secret` key which contains a
   * usable ephemeral API token that can be used to authenticate browser clients for
   * the Realtime API.
   *
   * @example
   * ```ts
   * const session =
   *   await client.beta.realtime.sessions.create();
   * ```
   */
  create(body, options) {
    return this._client.post("/realtime/sessions", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
};

// node_modules/openai/resources/beta/realtime/transcription-sessions.mjs
init_cjs_shims();
var TranscriptionSessions = class extends APIResource {
  /**
   * Create an ephemeral API token for use in client-side applications with the
   * Realtime API specifically for realtime transcriptions. Can be configured with
   * the same session parameters as the `transcription_session.update` client event.
   *
   * It responds with a session object, plus a `client_secret` key which contains a
   * usable ephemeral API token that can be used to authenticate browser clients for
   * the Realtime API.
   *
   * @example
   * ```ts
   * const transcriptionSession =
   *   await client.beta.realtime.transcriptionSessions.create();
   * ```
   */
  create(body, options) {
    return this._client.post("/realtime/transcription_sessions", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
};

// node_modules/openai/resources/beta/realtime/realtime.mjs
var Realtime = class extends APIResource {
  constructor() {
    super(...arguments);
    this.sessions = new Sessions(this._client);
    this.transcriptionSessions = new TranscriptionSessions(this._client);
  }
};
Realtime.Sessions = Sessions;
Realtime.TranscriptionSessions = TranscriptionSessions;

// node_modules/openai/resources/beta/threads/threads.mjs
init_cjs_shims();

// node_modules/openai/resources/beta/threads/messages.mjs
init_cjs_shims();
var Messages2 = class extends APIResource {
  /**
   * Create a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  create(threadID, body, options) {
    return this._client.post(path5`/threads/${threadID}/messages`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Retrieve a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(messageID, params, options) {
    const { thread_id } = params;
    return this._client.get(path5`/threads/${thread_id}/messages/${messageID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Modifies a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(messageID, params, options) {
    const { thread_id, ...body } = params;
    return this._client.post(path5`/threads/${thread_id}/messages/${messageID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Returns a list of messages for a given thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(threadID, query = {}, options) {
    return this._client.getAPIList(path5`/threads/${threadID}/messages`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Deletes a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  delete(messageID, params, options) {
    const { thread_id } = params;
    return this._client.delete(path5`/threads/${thread_id}/messages/${messageID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
};

// node_modules/openai/resources/beta/threads/runs/runs.mjs
init_cjs_shims();

// node_modules/openai/resources/beta/threads/runs/steps.mjs
init_cjs_shims();
var Steps = class extends APIResource {
  /**
   * Retrieves a run step.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(stepID, params, options) {
    const { thread_id, run_id, ...query } = params;
    return this._client.get(path5`/threads/${thread_id}/runs/${run_id}/steps/${stepID}`, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Returns a list of run steps belonging to a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(runID, params, options) {
    const { thread_id, ...query } = params;
    return this._client.getAPIList(path5`/threads/${thread_id}/runs/${runID}/steps`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
};

// node_modules/openai/lib/AssistantStream.mjs
init_cjs_shims();

// node_modules/openai/internal/utils.mjs
init_cjs_shims();

// node_modules/openai/internal/utils/base64.mjs
init_cjs_shims();
var toFloat32Array = (base64Str) => {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64Str, "base64");
    return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT));
  } else {
    const binaryStr = atob(base64Str);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return Array.from(new Float32Array(bytes.buffer));
  }
};

// node_modules/openai/internal/utils/env.mjs
init_cjs_shims();
var readEnv = (env) => {
  var _a3, _b, _c, _d, _e;
  if (typeof globalThis.process !== "undefined") {
    return ((_b = (_a3 = globalThis.process.env) == null ? void 0 : _a3[env]) == null ? void 0 : _b.trim()) ?? void 0;
  }
  if (typeof globalThis.Deno !== "undefined") {
    return (_e = (_d = (_c = globalThis.Deno.env) == null ? void 0 : _c.get) == null ? void 0 : _d.call(_c, env)) == null ? void 0 : _e.trim();
  }
  return void 0;
};

// node_modules/openai/lib/AssistantStream.mjs
var _AssistantStream_instances;
var _a;
var _AssistantStream_events;
var _AssistantStream_runStepSnapshots;
var _AssistantStream_messageSnapshots;
var _AssistantStream_messageSnapshot;
var _AssistantStream_finalRun;
var _AssistantStream_currentContentIndex;
var _AssistantStream_currentContent;
var _AssistantStream_currentToolCallIndex;
var _AssistantStream_currentToolCall;
var _AssistantStream_currentEvent;
var _AssistantStream_currentRunSnapshot;
var _AssistantStream_currentRunStepSnapshot;
var _AssistantStream_addEvent;
var _AssistantStream_endRequest;
var _AssistantStream_handleMessage;
var _AssistantStream_handleRunStep;
var _AssistantStream_handleEvent;
var _AssistantStream_accumulateRunStep;
var _AssistantStream_accumulateMessage;
var _AssistantStream_accumulateContent;
var _AssistantStream_handleRun;
var AssistantStream = class extends EventStream {
  constructor() {
    super(...arguments);
    _AssistantStream_instances.add(this);
    _AssistantStream_events.set(this, []);
    _AssistantStream_runStepSnapshots.set(this, {});
    _AssistantStream_messageSnapshots.set(this, {});
    _AssistantStream_messageSnapshot.set(this, void 0);
    _AssistantStream_finalRun.set(this, void 0);
    _AssistantStream_currentContentIndex.set(this, void 0);
    _AssistantStream_currentContent.set(this, void 0);
    _AssistantStream_currentToolCallIndex.set(this, void 0);
    _AssistantStream_currentToolCall.set(this, void 0);
    _AssistantStream_currentEvent.set(this, void 0);
    _AssistantStream_currentRunSnapshot.set(this, void 0);
    _AssistantStream_currentRunStepSnapshot.set(this, void 0);
  }
  [(_AssistantStream_events = /* @__PURE__ */ new WeakMap(), _AssistantStream_runStepSnapshots = /* @__PURE__ */ new WeakMap(), _AssistantStream_messageSnapshots = /* @__PURE__ */ new WeakMap(), _AssistantStream_messageSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_finalRun = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentContentIndex = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentContent = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentToolCallIndex = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentToolCall = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentEvent = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentRunSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_currentRunStepSnapshot = /* @__PURE__ */ new WeakMap(), _AssistantStream_instances = /* @__PURE__ */ new WeakSet(), Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("event", (event) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(event);
      } else {
        pushQueue.push(event);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk2) => chunk2 ? { value: chunk2, done: false } : { value: void 0, done: true });
        }
        const chunk = pushQueue.shift();
        return { value: chunk, done: false };
      },
      return: async () => {
        this.abort();
        return { value: void 0, done: true };
      }
    };
  }
  static fromReadableStream(stream) {
    const runner = new _a();
    runner._run(() => runner._fromReadableStream(stream));
    return runner;
  }
  async _fromReadableStream(readableStream, options) {
    var _a3;
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    this._connected();
    const stream = Stream.fromReadableStream(readableStream, this.controller);
    for await (const event of stream) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if ((_a3 = stream.controller.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  toReadableStream() {
    const stream = new Stream(this[Symbol.asyncIterator].bind(this), this.controller);
    return stream.toReadableStream();
  }
  static createToolAssistantStream(runId, runs, params, options) {
    const runner = new _a();
    runner._run(() => runner._runToolAssistantStream(runId, runs, params, {
      ...options,
      headers: { ...options == null ? void 0 : options.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  async _createToolAssistantStream(run, runId, params, options) {
    var _a3;
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    const body = { ...params, stream: true };
    const stream = await run.submitToolOutputs(runId, body, {
      ...options,
      signal: this.controller.signal
    });
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if ((_a3 = stream.controller.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  static createThreadAssistantStream(params, thread, options) {
    const runner = new _a();
    runner._run(() => runner._threadAssistantStream(params, thread, {
      ...options,
      headers: { ...options == null ? void 0 : options.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  static createAssistantStream(threadId, runs, params, options) {
    const runner = new _a();
    runner._run(() => runner._runAssistantStream(threadId, runs, params, {
      ...options,
      headers: { ...options == null ? void 0 : options.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  currentEvent() {
    return __classPrivateFieldGet(this, _AssistantStream_currentEvent, "f");
  }
  currentRun() {
    return __classPrivateFieldGet(this, _AssistantStream_currentRunSnapshot, "f");
  }
  currentMessageSnapshot() {
    return __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f");
  }
  currentRunStepSnapshot() {
    return __classPrivateFieldGet(this, _AssistantStream_currentRunStepSnapshot, "f");
  }
  async finalRunSteps() {
    await this.done();
    return Object.values(__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f"));
  }
  async finalMessages() {
    await this.done();
    return Object.values(__classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f"));
  }
  async finalRun() {
    await this.done();
    if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
      throw Error("Final run was not received.");
    return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
  }
  async _createThreadAssistantStream(thread, params, options) {
    var _a3;
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    const body = { ...params, stream: true };
    const stream = await thread.createAndRun(body, { ...options, signal: this.controller.signal });
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if ((_a3 = stream.controller.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  async _createAssistantStream(run, threadId, params, options) {
    var _a3;
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    const body = { ...params, stream: true };
    const stream = await run.create(threadId, body, { ...options, signal: this.controller.signal });
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
    }
    if ((_a3 = stream.controller.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    return this._addRun(__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
  }
  static accumulateDelta(acc, delta) {
    for (const [key, deltaValue] of Object.entries(delta)) {
      if (!acc.hasOwnProperty(key)) {
        acc[key] = deltaValue;
        continue;
      }
      let accValue = acc[key];
      if (accValue === null || accValue === void 0) {
        acc[key] = deltaValue;
        continue;
      }
      if (key === "index" || key === "type") {
        acc[key] = deltaValue;
        continue;
      }
      if (typeof accValue === "string" && typeof deltaValue === "string") {
        accValue += deltaValue;
      } else if (typeof accValue === "number" && typeof deltaValue === "number") {
        accValue += deltaValue;
      } else if (isObj(accValue) && isObj(deltaValue)) {
        accValue = this.accumulateDelta(accValue, deltaValue);
      } else if (Array.isArray(accValue) && Array.isArray(deltaValue)) {
        if (accValue.every((x) => typeof x === "string" || typeof x === "number")) {
          accValue.push(...deltaValue);
          continue;
        }
        for (const deltaEntry of deltaValue) {
          if (!isObj(deltaEntry)) {
            throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
          }
          const index = deltaEntry["index"];
          if (index == null) {
            console.error(deltaEntry);
            throw new Error("Expected array delta entry to have an `index` property");
          }
          if (typeof index !== "number") {
            throw new Error(`Expected array delta entry \`index\` property to be a number but got ${index}`);
          }
          const accEntry = accValue[index];
          if (accEntry == null) {
            accValue.push(deltaEntry);
          } else {
            accValue[index] = this.accumulateDelta(accEntry, deltaEntry);
          }
        }
        continue;
      } else {
        throw Error(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accValue}`);
      }
      acc[key] = accValue;
    }
    return acc;
  }
  _addRun(run) {
    return run;
  }
  async _threadAssistantStream(params, thread, options) {
    return await this._createThreadAssistantStream(thread, params, options);
  }
  async _runAssistantStream(threadId, runs, params, options) {
    return await this._createAssistantStream(runs, threadId, params, options);
  }
  async _runToolAssistantStream(runId, runs, params, options) {
    return await this._createToolAssistantStream(runs, runId, params, options);
  }
};
_a = AssistantStream, _AssistantStream_addEvent = function _AssistantStream_addEvent2(event) {
  if (this.ended)
    return;
  __classPrivateFieldSet(this, _AssistantStream_currentEvent, event, "f");
  __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleEvent).call(this, event);
  switch (event.event) {
    case "thread.created":
      break;
    case "thread.run.created":
    case "thread.run.queued":
    case "thread.run.in_progress":
    case "thread.run.requires_action":
    case "thread.run.completed":
    case "thread.run.incomplete":
    case "thread.run.failed":
    case "thread.run.cancelling":
    case "thread.run.cancelled":
    case "thread.run.expired":
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRun).call(this, event);
      break;
    case "thread.run.step.created":
    case "thread.run.step.in_progress":
    case "thread.run.step.delta":
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRunStep).call(this, event);
      break;
    case "thread.message.created":
    case "thread.message.in_progress":
    case "thread.message.delta":
    case "thread.message.completed":
    case "thread.message.incomplete":
      __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleMessage).call(this, event);
      break;
    case "error":
      throw new Error("Encountered an error event in event processing - errors should be processed earlier");
    default:
      assertNever2(event);
  }
}, _AssistantStream_endRequest = function _AssistantStream_endRequest2() {
  if (this.ended) {
    throw new OpenAIError(`stream has ended, this shouldn't happen`);
  }
  if (!__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
    throw Error("Final run has not been received");
  return __classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
}, _AssistantStream_handleMessage = function _AssistantStream_handleMessage2(event) {
  const [accumulatedMessage, newContent] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateMessage).call(this, event, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
  __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, accumulatedMessage, "f");
  __classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f")[accumulatedMessage.id] = accumulatedMessage;
  for (const content of newContent) {
    const snapshotContent = accumulatedMessage.content[content.index];
    if ((snapshotContent == null ? void 0 : snapshotContent.type) == "text") {
      this._emit("textCreated", snapshotContent.text);
    }
  }
  switch (event.event) {
    case "thread.message.created":
      this._emit("messageCreated", event.data);
      break;
    case "thread.message.in_progress":
      break;
    case "thread.message.delta":
      this._emit("messageDelta", event.data.delta, accumulatedMessage);
      if (event.data.delta.content) {
        for (const content of event.data.delta.content) {
          if (content.type == "text" && content.text) {
            let textDelta = content.text;
            let snapshot = accumulatedMessage.content[content.index];
            if (snapshot && snapshot.type == "text") {
              this._emit("textDelta", textDelta, snapshot.text);
            } else {
              throw Error("The snapshot associated with this text delta is not text or missing");
            }
          }
          if (content.index != __classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")) {
            if (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f")) {
              switch (__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").type) {
                case "text":
                  this._emit("textDone", __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                  break;
                case "image_file":
                  this._emit("imageFileDone", __classPrivateFieldGet(this, _AssistantStream_currentContent, "f").image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                  break;
              }
            }
            __classPrivateFieldSet(this, _AssistantStream_currentContentIndex, content.index, "f");
          }
          __classPrivateFieldSet(this, _AssistantStream_currentContent, accumulatedMessage.content[content.index], "f");
        }
      }
      break;
    case "thread.message.completed":
    case "thread.message.incomplete":
      if (__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f") !== void 0) {
        const currentContent = event.data.content[__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")];
        if (currentContent) {
          switch (currentContent.type) {
            case "image_file":
              this._emit("imageFileDone", currentContent.image_file, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
              break;
            case "text":
              this._emit("textDone", currentContent.text, __classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
              break;
          }
        }
      }
      if (__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f")) {
        this._emit("messageDone", event.data);
      }
      __classPrivateFieldSet(this, _AssistantStream_messageSnapshot, void 0, "f");
  }
}, _AssistantStream_handleRunStep = function _AssistantStream_handleRunStep2(event) {
  const accumulatedRunStep = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateRunStep).call(this, event);
  __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, accumulatedRunStep, "f");
  switch (event.event) {
    case "thread.run.step.created":
      this._emit("runStepCreated", event.data);
      break;
    case "thread.run.step.delta":
      const delta = event.data.delta;
      if (delta.step_details && delta.step_details.type == "tool_calls" && delta.step_details.tool_calls && accumulatedRunStep.step_details.type == "tool_calls") {
        for (const toolCall of delta.step_details.tool_calls) {
          if (toolCall.index == __classPrivateFieldGet(this, _AssistantStream_currentToolCallIndex, "f")) {
            this._emit("toolCallDelta", toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
          } else {
            if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
              this._emit("toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
            }
            __classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, toolCall.index, "f");
            __classPrivateFieldSet(this, _AssistantStream_currentToolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index], "f");
            if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"))
              this._emit("toolCallCreated", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
          }
        }
      }
      this._emit("runStepDelta", event.data.delta, accumulatedRunStep);
      break;
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
      __classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, void 0, "f");
      const details = event.data.step_details;
      if (details.type == "tool_calls") {
        if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
          this._emit("toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
          __classPrivateFieldSet(this, _AssistantStream_currentToolCall, void 0, "f");
        }
      }
      this._emit("runStepDone", event.data, accumulatedRunStep);
      break;
    case "thread.run.step.in_progress":
      break;
  }
}, _AssistantStream_handleEvent = function _AssistantStream_handleEvent2(event) {
  __classPrivateFieldGet(this, _AssistantStream_events, "f").push(event);
  this._emit("event", event);
}, _AssistantStream_accumulateRunStep = function _AssistantStream_accumulateRunStep2(event) {
  switch (event.event) {
    case "thread.run.step.created":
      __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
      return event.data;
    case "thread.run.step.delta":
      let snapshot = __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
      if (!snapshot) {
        throw Error("Received a RunStepDelta before creation of a snapshot");
      }
      let data = event.data;
      if (data.delta) {
        const accumulated = _a.accumulateDelta(snapshot, data.delta);
        __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = accumulated;
      }
      return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
    case "thread.run.step.in_progress":
      __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
      break;
  }
  if (__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id])
    return __classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
  throw new Error("No snapshot available");
}, _AssistantStream_accumulateMessage = function _AssistantStream_accumulateMessage2(event, snapshot) {
  let newContent = [];
  switch (event.event) {
    case "thread.message.created":
      return [event.data, newContent];
    case "thread.message.delta":
      if (!snapshot) {
        throw Error("Received a delta with no existing snapshot (there should be one from message creation)");
      }
      let data = event.data;
      if (data.delta.content) {
        for (const contentElement of data.delta.content) {
          if (contentElement.index in snapshot.content) {
            let currentContent = snapshot.content[contentElement.index];
            snapshot.content[contentElement.index] = __classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateContent).call(this, contentElement, currentContent);
          } else {
            snapshot.content[contentElement.index] = contentElement;
            newContent.push(contentElement);
          }
        }
      }
      return [snapshot, newContent];
    case "thread.message.in_progress":
    case "thread.message.completed":
    case "thread.message.incomplete":
      if (snapshot) {
        return [snapshot, newContent];
      } else {
        throw Error("Received thread message event with no existing snapshot");
      }
  }
  throw Error("Tried to accumulate a non-message event");
}, _AssistantStream_accumulateContent = function _AssistantStream_accumulateContent2(contentElement, currentContent) {
  return _a.accumulateDelta(currentContent, contentElement);
}, _AssistantStream_handleRun = function _AssistantStream_handleRun2(event) {
  __classPrivateFieldSet(this, _AssistantStream_currentRunSnapshot, event.data, "f");
  switch (event.event) {
    case "thread.run.created":
      break;
    case "thread.run.queued":
      break;
    case "thread.run.in_progress":
      break;
    case "thread.run.requires_action":
    case "thread.run.cancelled":
    case "thread.run.failed":
    case "thread.run.completed":
    case "thread.run.expired":
    case "thread.run.incomplete":
      __classPrivateFieldSet(this, _AssistantStream_finalRun, event.data, "f");
      if (__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
        this._emit("toolCallDone", __classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
        __classPrivateFieldSet(this, _AssistantStream_currentToolCall, void 0, "f");
      }
      break;
    case "thread.run.cancelling":
      break;
  }
};
function assertNever2(_x) {
}

// node_modules/openai/resources/beta/threads/runs/runs.mjs
var Runs = class extends APIResource {
  constructor() {
    super(...arguments);
    this.steps = new Steps(this._client);
  }
  create(threadID, params, options) {
    const { include, ...body } = params;
    return this._client.post(path5`/threads/${threadID}/runs`, {
      query: { include },
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers]),
      stream: params.stream ?? false
    });
  }
  /**
   * Retrieves a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(runID, params, options) {
    const { thread_id } = params;
    return this._client.get(path5`/threads/${thread_id}/runs/${runID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Modifies a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(runID, params, options) {
    const { thread_id, ...body } = params;
    return this._client.post(path5`/threads/${thread_id}/runs/${runID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Returns a list of runs belonging to a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(threadID, query = {}, options) {
    return this._client.getAPIList(path5`/threads/${threadID}/runs`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Cancels a run that is `in_progress`.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  cancel(runID, params, options) {
    const { thread_id } = params;
    return this._client.post(path5`/threads/${thread_id}/runs/${runID}/cancel`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * A helper to create a run an poll for a terminal state. More information on Run
   * lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndPoll(threadId, body, options) {
    const run = await this.create(threadId, body, options);
    return await this.poll(run.id, { thread_id: threadId }, options);
  }
  /**
   * Create a Run stream
   *
   * @deprecated use `stream` instead
   */
  createAndStream(threadId, body, options) {
    return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
  }
  /**
   * A helper to poll a run status until it reaches a terminal state. More
   * information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async poll(runId, params, options) {
    var _a3;
    const headers = buildHeaders([
      options == null ? void 0 : options.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": ((_a3 = options == null ? void 0 : options.pollIntervalMs) == null ? void 0 : _a3.toString()) ?? void 0
      }
    ]);
    while (true) {
      const { data: run, response } = await this.retrieve(runId, params, {
        ...options,
        headers: { ...options == null ? void 0 : options.headers, ...headers }
      }).withResponse();
      switch (run.status) {
        //If we are in any sort of intermediate state we poll
        case "queued":
        case "in_progress":
        case "cancelling":
          let sleepInterval = 5e3;
          if (options == null ? void 0 : options.pollIntervalMs) {
            sleepInterval = options.pollIntervalMs;
          } else {
            const headerInterval = response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        //We return the run in any terminal state.
        case "requires_action":
        case "incomplete":
        case "cancelled":
        case "completed":
        case "failed":
        case "expired":
          return run;
      }
    }
  }
  /**
   * Create a Run stream
   */
  stream(threadId, body, options) {
    return AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
  }
  submitToolOutputs(runID, params, options) {
    const { thread_id, ...body } = params;
    return this._client.post(path5`/threads/${thread_id}/runs/${runID}/submit_tool_outputs`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers]),
      stream: params.stream ?? false
    });
  }
  /**
   * A helper to submit a tool output to a run and poll for a terminal run state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async submitToolOutputsAndPoll(runId, params, options) {
    const run = await this.submitToolOutputs(runId, params, options);
    return await this.poll(run.id, params, options);
  }
  /**
   * Submit the tool outputs from a previous run and stream the run to a terminal
   * state. More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  submitToolOutputsStream(runId, params, options) {
    return AssistantStream.createToolAssistantStream(runId, this._client.beta.threads.runs, params, options);
  }
};
Runs.Steps = Steps;

// node_modules/openai/resources/beta/threads/threads.mjs
var Threads = class extends APIResource {
  constructor() {
    super(...arguments);
    this.runs = new Runs(this._client);
    this.messages = new Messages2(this._client);
  }
  /**
   * Create a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  create(body = {}, options) {
    return this._client.post("/threads", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Retrieves a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(threadID, options) {
    return this._client.get(path5`/threads/${threadID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Modifies a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(threadID, body, options) {
    return this._client.post(path5`/threads/${threadID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Delete a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  delete(threadID, options) {
    return this._client.delete(path5`/threads/${threadID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  createAndRun(body, options) {
    return this._client.post("/threads/runs", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers]),
      stream: body.stream ?? false
    });
  }
  /**
   * A helper to create a thread, start a run and then poll for a terminal state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndRunPoll(body, options) {
    const run = await this.createAndRun(body, options);
    return await this.runs.poll(run.id, { thread_id: run.thread_id }, options);
  }
  /**
   * Create a thread and stream the run back
   */
  createAndRunStream(body, options) {
    return AssistantStream.createThreadAssistantStream(body, this._client.beta.threads, options);
  }
};
Threads.Runs = Runs;
Threads.Messages = Messages2;

// node_modules/openai/resources/beta/beta.mjs
var Beta = class extends APIResource {
  constructor() {
    super(...arguments);
    this.realtime = new Realtime(this._client);
    this.assistants = new Assistants(this._client);
    this.threads = new Threads(this._client);
  }
};
Beta.Realtime = Realtime;
Beta.Assistants = Assistants;
Beta.Threads = Threads;

// node_modules/openai/resources/completions.mjs
init_cjs_shims();
var Completions2 = class extends APIResource {
  create(body, options) {
    return this._client.post("/completions", { body, ...options, stream: body.stream ?? false });
  }
};

// node_modules/openai/resources/containers/containers.mjs
init_cjs_shims();

// node_modules/openai/resources/containers/files/files.mjs
init_cjs_shims();

// node_modules/openai/resources/containers/files/content.mjs
init_cjs_shims();
var Content = class extends APIResource {
  /**
   * Retrieve Container File Content
   */
  retrieve(fileID, params, options) {
    const { container_id } = params;
    return this._client.get(path5`/containers/${container_id}/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options == null ? void 0 : options.headers]),
      __binaryResponse: true
    });
  }
};

// node_modules/openai/resources/containers/files/files.mjs
var Files = class extends APIResource {
  constructor() {
    super(...arguments);
    this.content = new Content(this._client);
  }
  /**
   * Create a Container File
   *
   * You can send either a multipart/form-data request with the raw file content, or
   * a JSON request with a file ID.
   */
  create(containerID, body, options) {
    return this._client.post(path5`/containers/${containerID}/files`, multipartFormRequestOptions({ body, ...options }, this._client));
  }
  /**
   * Retrieve Container File
   */
  retrieve(fileID, params, options) {
    const { container_id } = params;
    return this._client.get(path5`/containers/${container_id}/files/${fileID}`, options);
  }
  /**
   * List Container files
   */
  list(containerID, query = {}, options) {
    return this._client.getAPIList(path5`/containers/${containerID}/files`, CursorPage, {
      query,
      ...options
    });
  }
  /**
   * Delete Container File
   */
  delete(fileID, params, options) {
    const { container_id } = params;
    return this._client.delete(path5`/containers/${container_id}/files/${fileID}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options == null ? void 0 : options.headers])
    });
  }
};
Files.Content = Content;

// node_modules/openai/resources/containers/containers.mjs
var Containers = class extends APIResource {
  constructor() {
    super(...arguments);
    this.files = new Files(this._client);
  }
  /**
   * Create Container
   */
  create(body, options) {
    return this._client.post("/containers", { body, ...options });
  }
  /**
   * Retrieve Container
   */
  retrieve(containerID, options) {
    return this._client.get(path5`/containers/${containerID}`, options);
  }
  /**
   * List Containers
   */
  list(query = {}, options) {
    return this._client.getAPIList("/containers", CursorPage, { query, ...options });
  }
  /**
   * Delete Container
   */
  delete(containerID, options) {
    return this._client.delete(path5`/containers/${containerID}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options == null ? void 0 : options.headers])
    });
  }
};
Containers.Files = Files;

// node_modules/openai/resources/embeddings.mjs
init_cjs_shims();
var Embeddings = class extends APIResource {
  /**
   * Creates an embedding vector representing the input text.
   *
   * @example
   * ```ts
   * const createEmbeddingResponse =
   *   await client.embeddings.create({
   *     input: 'The quick brown fox jumped over the lazy dog',
   *     model: 'text-embedding-3-small',
   *   });
   * ```
   */
  create(body, options) {
    const hasUserProvidedEncodingFormat = !!body.encoding_format;
    let encoding_format = hasUserProvidedEncodingFormat ? body.encoding_format : "base64";
    if (hasUserProvidedEncodingFormat) {
      loggerFor(this._client).debug("embeddings/user defined encoding_format:", body.encoding_format);
    }
    const response = this._client.post("/embeddings", {
      body: {
        ...body,
        encoding_format
      },
      ...options
    });
    if (hasUserProvidedEncodingFormat) {
      return response;
    }
    loggerFor(this._client).debug("embeddings/decoding base64 embeddings from base64");
    return response._thenUnwrap((response2) => {
      if (response2 && response2.data) {
        response2.data.forEach((embeddingBase64Obj) => {
          const embeddingBase64Str = embeddingBase64Obj.embedding;
          embeddingBase64Obj.embedding = toFloat32Array(embeddingBase64Str);
        });
      }
      return response2;
    });
  }
};

// node_modules/openai/resources/evals/evals.mjs
init_cjs_shims();

// node_modules/openai/resources/evals/runs/runs.mjs
init_cjs_shims();

// node_modules/openai/resources/evals/runs/output-items.mjs
init_cjs_shims();
var OutputItems = class extends APIResource {
  /**
   * Get an evaluation run output item by ID.
   */
  retrieve(outputItemID, params, options) {
    const { eval_id, run_id } = params;
    return this._client.get(path5`/evals/${eval_id}/runs/${run_id}/output_items/${outputItemID}`, options);
  }
  /**
   * Get a list of output items for an evaluation run.
   */
  list(runID, params, options) {
    const { eval_id, ...query } = params;
    return this._client.getAPIList(path5`/evals/${eval_id}/runs/${runID}/output_items`, CursorPage, { query, ...options });
  }
};

// node_modules/openai/resources/evals/runs/runs.mjs
var Runs2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.outputItems = new OutputItems(this._client);
  }
  /**
   * Kicks off a new run for a given evaluation, specifying the data source, and what
   * model configuration to use to test. The datasource will be validated against the
   * schema specified in the config of the evaluation.
   */
  create(evalID, body, options) {
    return this._client.post(path5`/evals/${evalID}/runs`, { body, ...options });
  }
  /**
   * Get an evaluation run by ID.
   */
  retrieve(runID, params, options) {
    const { eval_id } = params;
    return this._client.get(path5`/evals/${eval_id}/runs/${runID}`, options);
  }
  /**
   * Get a list of runs for an evaluation.
   */
  list(evalID, query = {}, options) {
    return this._client.getAPIList(path5`/evals/${evalID}/runs`, CursorPage, {
      query,
      ...options
    });
  }
  /**
   * Delete an eval run.
   */
  delete(runID, params, options) {
    const { eval_id } = params;
    return this._client.delete(path5`/evals/${eval_id}/runs/${runID}`, options);
  }
  /**
   * Cancel an ongoing evaluation run.
   */
  cancel(runID, params, options) {
    const { eval_id } = params;
    return this._client.post(path5`/evals/${eval_id}/runs/${runID}`, options);
  }
};
Runs2.OutputItems = OutputItems;

// node_modules/openai/resources/evals/evals.mjs
var Evals = class extends APIResource {
  constructor() {
    super(...arguments);
    this.runs = new Runs2(this._client);
  }
  /**
   * Create the structure of an evaluation that can be used to test a model's
   * performance. An evaluation is a set of testing criteria and the config for a
   * data source, which dictates the schema of the data used in the evaluation. After
   * creating an evaluation, you can run it on different models and model parameters.
   * We support several types of graders and datasources. For more information, see
   * the [Evals guide](https://platform.openai.com/docs/guides/evals).
   */
  create(body, options) {
    return this._client.post("/evals", { body, ...options });
  }
  /**
   * Get an evaluation by ID.
   */
  retrieve(evalID, options) {
    return this._client.get(path5`/evals/${evalID}`, options);
  }
  /**
   * Update certain properties of an evaluation.
   */
  update(evalID, body, options) {
    return this._client.post(path5`/evals/${evalID}`, { body, ...options });
  }
  /**
   * List evaluations for a project.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/evals", CursorPage, { query, ...options });
  }
  /**
   * Delete an evaluation.
   */
  delete(evalID, options) {
    return this._client.delete(path5`/evals/${evalID}`, options);
  }
};
Evals.Runs = Runs2;

// node_modules/openai/resources/files.mjs
init_cjs_shims();
var Files2 = class extends APIResource {
  /**
   * Upload a file that can be used across various endpoints. Individual files can be
   * up to 512 MB, and the size of all files uploaded by one organization can be up
   * to 100 GB.
   *
   * The Assistants API supports files up to 2 million tokens and of specific file
   * types. See the
   * [Assistants Tools guide](https://platform.openai.com/docs/assistants/tools) for
   * details.
   *
   * The Fine-tuning API only supports `.jsonl` files. The input also has certain
   * required formats for fine-tuning
   * [chat](https://platform.openai.com/docs/api-reference/fine-tuning/chat-input) or
   * [completions](https://platform.openai.com/docs/api-reference/fine-tuning/completions-input)
   * models.
   *
   * The Batch API only supports `.jsonl` files up to 200 MB in size. The input also
   * has a specific required
   * [format](https://platform.openai.com/docs/api-reference/batch/request-input).
   *
   * Please [contact us](https://help.openai.com/) if you need to increase these
   * storage limits.
   */
  create(body, options) {
    return this._client.post("/files", multipartFormRequestOptions({ body, ...options }, this._client));
  }
  /**
   * Returns information about a specific file.
   */
  retrieve(fileID, options) {
    return this._client.get(path5`/files/${fileID}`, options);
  }
  /**
   * Returns a list of files.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/files", CursorPage, { query, ...options });
  }
  /**
   * Delete a file.
   */
  delete(fileID, options) {
    return this._client.delete(path5`/files/${fileID}`, options);
  }
  /**
   * Returns the contents of the specified file.
   */
  content(fileID, options) {
    return this._client.get(path5`/files/${fileID}/content`, {
      ...options,
      headers: buildHeaders([{ Accept: "application/binary" }, options == null ? void 0 : options.headers]),
      __binaryResponse: true
    });
  }
  /**
   * Waits for the given file to be processed, default timeout is 30 mins.
   */
  async waitForProcessing(id, { pollInterval = 5e3, maxWait = 30 * 60 * 1e3 } = {}) {
    const TERMINAL_STATES = /* @__PURE__ */ new Set(["processed", "error", "deleted"]);
    const start = Date.now();
    let file = await this.retrieve(id);
    while (!file.status || !TERMINAL_STATES.has(file.status)) {
      await sleep(pollInterval);
      file = await this.retrieve(id);
      if (Date.now() - start > maxWait) {
        throw new APIConnectionTimeoutError({
          message: `Giving up on waiting for file ${id} to finish processing after ${maxWait} milliseconds.`
        });
      }
    }
    return file;
  }
};

// node_modules/openai/resources/fine-tuning/fine-tuning.mjs
init_cjs_shims();

// node_modules/openai/resources/fine-tuning/methods.mjs
init_cjs_shims();
var Methods = class extends APIResource {
};

// node_modules/openai/resources/fine-tuning/alpha/alpha.mjs
init_cjs_shims();

// node_modules/openai/resources/fine-tuning/alpha/graders.mjs
init_cjs_shims();
var Graders = class extends APIResource {
  /**
   * Run a grader.
   *
   * @example
   * ```ts
   * const response = await client.fineTuning.alpha.graders.run({
   *   grader: {
   *     input: 'input',
   *     name: 'name',
   *     operation: 'eq',
   *     reference: 'reference',
   *     type: 'string_check',
   *   },
   *   model_sample: 'model_sample',
   * });
   * ```
   */
  run(body, options) {
    return this._client.post("/fine_tuning/alpha/graders/run", { body, ...options });
  }
  /**
   * Validate a grader.
   *
   * @example
   * ```ts
   * const response =
   *   await client.fineTuning.alpha.graders.validate({
   *     grader: {
   *       input: 'input',
   *       name: 'name',
   *       operation: 'eq',
   *       reference: 'reference',
   *       type: 'string_check',
   *     },
   *   });
   * ```
   */
  validate(body, options) {
    return this._client.post("/fine_tuning/alpha/graders/validate", { body, ...options });
  }
};

// node_modules/openai/resources/fine-tuning/alpha/alpha.mjs
var Alpha = class extends APIResource {
  constructor() {
    super(...arguments);
    this.graders = new Graders(this._client);
  }
};
Alpha.Graders = Graders;

// node_modules/openai/resources/fine-tuning/checkpoints/checkpoints.mjs
init_cjs_shims();

// node_modules/openai/resources/fine-tuning/checkpoints/permissions.mjs
init_cjs_shims();
var Permissions = class extends APIResource {
  /**
   * **NOTE:** Calling this endpoint requires an [admin API key](../admin-api-keys).
   *
   * This enables organization owners to share fine-tuned models with other projects
   * in their organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const permissionCreateResponse of client.fineTuning.checkpoints.permissions.create(
   *   'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
   *   { project_ids: ['string'] },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(fineTunedModelCheckpoint, body, options) {
    return this._client.getAPIList(path5`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, Page, { body, method: "post", ...options });
  }
  /**
   * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
   *
   * Organization owners can use this endpoint to view all permissions for a
   * fine-tuned model checkpoint.
   *
   * @example
   * ```ts
   * const permission =
   *   await client.fineTuning.checkpoints.permissions.retrieve(
   *     'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   *   );
   * ```
   */
  retrieve(fineTunedModelCheckpoint, query = {}, options) {
    return this._client.get(path5`/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, {
      query,
      ...options
    });
  }
  /**
   * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
   *
   * Organization owners can use this endpoint to delete a permission for a
   * fine-tuned model checkpoint.
   *
   * @example
   * ```ts
   * const permission =
   *   await client.fineTuning.checkpoints.permissions.delete(
   *     'cp_zc4Q7MP6XxulcVzj4MZdwsAB',
   *     {
   *       fine_tuned_model_checkpoint:
   *         'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
   *     },
   *   );
   * ```
   */
  delete(permissionID, params, options) {
    const { fine_tuned_model_checkpoint } = params;
    return this._client.delete(path5`/fine_tuning/checkpoints/${fine_tuned_model_checkpoint}/permissions/${permissionID}`, options);
  }
};

// node_modules/openai/resources/fine-tuning/checkpoints/checkpoints.mjs
var Checkpoints = class extends APIResource {
  constructor() {
    super(...arguments);
    this.permissions = new Permissions(this._client);
  }
};
Checkpoints.Permissions = Permissions;

// node_modules/openai/resources/fine-tuning/jobs/jobs.mjs
init_cjs_shims();

// node_modules/openai/resources/fine-tuning/jobs/checkpoints.mjs
init_cjs_shims();
var Checkpoints2 = class extends APIResource {
  /**
   * List checkpoints for a fine-tuning job.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJobCheckpoint of client.fineTuning.jobs.checkpoints.list(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(fineTuningJobID, query = {}, options) {
    return this._client.getAPIList(path5`/fine_tuning/jobs/${fineTuningJobID}/checkpoints`, CursorPage, { query, ...options });
  }
};

// node_modules/openai/resources/fine-tuning/jobs/jobs.mjs
var Jobs = class extends APIResource {
  constructor() {
    super(...arguments);
    this.checkpoints = new Checkpoints2(this._client);
  }
  /**
   * Creates a fine-tuning job which begins the process of creating a new model from
   * a given dataset.
   *
   * Response includes details of the enqueued job including job status and the name
   * of the fine-tuned models once complete.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/model-optimization)
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.create({
   *   model: 'gpt-4o-mini',
   *   training_file: 'file-abc123',
   * });
   * ```
   */
  create(body, options) {
    return this._client.post("/fine_tuning/jobs", { body, ...options });
  }
  /**
   * Get info about a fine-tuning job.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/model-optimization)
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.retrieve(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  retrieve(fineTuningJobID, options) {
    return this._client.get(path5`/fine_tuning/jobs/${fineTuningJobID}`, options);
  }
  /**
   * List your organization's fine-tuning jobs
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJob of client.fineTuning.jobs.list()) {
   *   // ...
   * }
   * ```
   */
  list(query = {}, options) {
    return this._client.getAPIList("/fine_tuning/jobs", CursorPage, { query, ...options });
  }
  /**
   * Immediately cancel a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.cancel(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  cancel(fineTuningJobID, options) {
    return this._client.post(path5`/fine_tuning/jobs/${fineTuningJobID}/cancel`, options);
  }
  /**
   * Get status updates for a fine-tuning job.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJobEvent of client.fineTuning.jobs.listEvents(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * )) {
   *   // ...
   * }
   * ```
   */
  listEvents(fineTuningJobID, query = {}, options) {
    return this._client.getAPIList(path5`/fine_tuning/jobs/${fineTuningJobID}/events`, CursorPage, { query, ...options });
  }
  /**
   * Pause a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.pause(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  pause(fineTuningJobID, options) {
    return this._client.post(path5`/fine_tuning/jobs/${fineTuningJobID}/pause`, options);
  }
  /**
   * Resume a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.resume(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  resume(fineTuningJobID, options) {
    return this._client.post(path5`/fine_tuning/jobs/${fineTuningJobID}/resume`, options);
  }
};
Jobs.Checkpoints = Checkpoints2;

// node_modules/openai/resources/fine-tuning/fine-tuning.mjs
var FineTuning = class extends APIResource {
  constructor() {
    super(...arguments);
    this.methods = new Methods(this._client);
    this.jobs = new Jobs(this._client);
    this.checkpoints = new Checkpoints(this._client);
    this.alpha = new Alpha(this._client);
  }
};
FineTuning.Methods = Methods;
FineTuning.Jobs = Jobs;
FineTuning.Checkpoints = Checkpoints;
FineTuning.Alpha = Alpha;

// node_modules/openai/resources/graders/graders.mjs
init_cjs_shims();

// node_modules/openai/resources/graders/grader-models.mjs
init_cjs_shims();
var GraderModels = class extends APIResource {
};

// node_modules/openai/resources/graders/graders.mjs
var Graders2 = class extends APIResource {
  constructor() {
    super(...arguments);
    this.graderModels = new GraderModels(this._client);
  }
};
Graders2.GraderModels = GraderModels;

// node_modules/openai/resources/images.mjs
init_cjs_shims();
var Images = class extends APIResource {
  /**
   * Creates a variation of a given image. This endpoint only supports `dall-e-2`.
   *
   * @example
   * ```ts
   * const imagesResponse = await client.images.createVariation({
   *   image: fs.createReadStream('otter.png'),
   * });
   * ```
   */
  createVariation(body, options) {
    return this._client.post("/images/variations", multipartFormRequestOptions({ body, ...options }, this._client));
  }
  edit(body, options) {
    return this._client.post("/images/edits", multipartFormRequestOptions({ body, ...options, stream: body.stream ?? false }, this._client));
  }
  generate(body, options) {
    return this._client.post("/images/generations", { body, ...options, stream: body.stream ?? false });
  }
};

// node_modules/openai/resources/models.mjs
init_cjs_shims();
var Models = class extends APIResource {
  /**
   * Retrieves a model instance, providing basic information about the model such as
   * the owner and permissioning.
   */
  retrieve(model, options) {
    return this._client.get(path5`/models/${model}`, options);
  }
  /**
   * Lists the currently available models, and provides basic information about each
   * one such as the owner and availability.
   */
  list(options) {
    return this._client.getAPIList("/models", Page, options);
  }
  /**
   * Delete a fine-tuned model. You must have the Owner role in your organization to
   * delete a model.
   */
  delete(model, options) {
    return this._client.delete(path5`/models/${model}`, options);
  }
};

// node_modules/openai/resources/moderations.mjs
init_cjs_shims();
var Moderations = class extends APIResource {
  /**
   * Classifies if text and/or image inputs are potentially harmful. Learn more in
   * the [moderation guide](https://platform.openai.com/docs/guides/moderation).
   */
  create(body, options) {
    return this._client.post("/moderations", { body, ...options });
  }
};

// node_modules/openai/resources/responses/responses.mjs
init_cjs_shims();

// node_modules/openai/lib/ResponsesParser.mjs
init_cjs_shims();
function maybeParseResponse(response, params) {
  if (!params || !hasAutoParseableInput2(params)) {
    return {
      ...response,
      output_parsed: null,
      output: response.output.map((item) => {
        if (item.type === "function_call") {
          return {
            ...item,
            parsed_arguments: null
          };
        }
        if (item.type === "message") {
          return {
            ...item,
            content: item.content.map((content) => ({
              ...content,
              parsed: null
            }))
          };
        } else {
          return item;
        }
      })
    };
  }
  return parseResponse(response, params);
}
function parseResponse(response, params) {
  const output = response.output.map((item) => {
    if (item.type === "function_call") {
      return {
        ...item,
        parsed_arguments: parseToolCall2(params, item)
      };
    }
    if (item.type === "message") {
      const content = item.content.map((content2) => {
        if (content2.type === "output_text") {
          return {
            ...content2,
            parsed: parseTextFormat(params, content2.text)
          };
        }
        return content2;
      });
      return {
        ...item,
        content
      };
    }
    return item;
  });
  const parsed = Object.assign({}, response, { output });
  if (!Object.getOwnPropertyDescriptor(response, "output_text")) {
    addOutputText(parsed);
  }
  Object.defineProperty(parsed, "output_parsed", {
    enumerable: true,
    get() {
      for (const output2 of parsed.output) {
        if (output2.type !== "message") {
          continue;
        }
        for (const content of output2.content) {
          if (content.type === "output_text" && content.parsed !== null) {
            return content.parsed;
          }
        }
      }
      return null;
    }
  });
  return parsed;
}
function parseTextFormat(params, content) {
  var _a3, _b, _c, _d;
  if (((_b = (_a3 = params.text) == null ? void 0 : _a3.format) == null ? void 0 : _b.type) !== "json_schema") {
    return null;
  }
  if ("$parseRaw" in ((_c = params.text) == null ? void 0 : _c.format)) {
    const text_format = (_d = params.text) == null ? void 0 : _d.format;
    return text_format.$parseRaw(content);
  }
  return JSON.parse(content);
}
function hasAutoParseableInput2(params) {
  var _a3;
  if (isAutoParsableResponseFormat((_a3 = params.text) == null ? void 0 : _a3.format)) {
    return true;
  }
  return false;
}
function isAutoParsableTool2(tool) {
  return (tool == null ? void 0 : tool["$brand"]) === "auto-parseable-tool";
}
function getInputToolByName(input_tools, name) {
  return input_tools.find((tool) => tool.type === "function" && tool.name === name);
}
function parseToolCall2(params, toolCall) {
  const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
  return {
    ...toolCall,
    ...toolCall,
    parsed_arguments: isAutoParsableTool2(inputTool) ? inputTool.$parseRaw(toolCall.arguments) : (inputTool == null ? void 0 : inputTool.strict) ? JSON.parse(toolCall.arguments) : null
  };
}
function addOutputText(rsp) {
  const texts = [];
  for (const output of rsp.output) {
    if (output.type !== "message") {
      continue;
    }
    for (const content of output.content) {
      if (content.type === "output_text") {
        texts.push(content.text);
      }
    }
  }
  rsp.output_text = texts.join("");
}

// node_modules/openai/lib/responses/ResponseStream.mjs
init_cjs_shims();
var _ResponseStream_instances;
var _ResponseStream_params;
var _ResponseStream_currentResponseSnapshot;
var _ResponseStream_finalResponse;
var _ResponseStream_beginRequest;
var _ResponseStream_addEvent;
var _ResponseStream_endRequest;
var _ResponseStream_accumulateResponse;
var ResponseStream = class _ResponseStream extends EventStream {
  constructor(params) {
    super();
    _ResponseStream_instances.add(this);
    _ResponseStream_params.set(this, void 0);
    _ResponseStream_currentResponseSnapshot.set(this, void 0);
    _ResponseStream_finalResponse.set(this, void 0);
    __classPrivateFieldSet(this, _ResponseStream_params, params, "f");
  }
  static createResponse(client, params, options) {
    const runner = new _ResponseStream(params);
    runner._run(() => runner._createOrRetrieveResponse(client, params, {
      ...options,
      headers: { ...options == null ? void 0 : options.headers, "X-Stainless-Helper-Method": "stream" }
    }));
    return runner;
  }
  async _createOrRetrieveResponse(client, params, options) {
    var _a3;
    const signal = options == null ? void 0 : options.signal;
    if (signal) {
      if (signal.aborted)
        this.controller.abort();
      signal.addEventListener("abort", () => this.controller.abort());
    }
    __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_beginRequest).call(this);
    let stream;
    let starting_after = null;
    if ("response_id" in params) {
      stream = await client.responses.retrieve(params.response_id, { stream: true }, { ...options, signal: this.controller.signal, stream: true });
      starting_after = params.starting_after ?? null;
    } else {
      stream = await client.responses.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
    }
    this._connected();
    for await (const event of stream) {
      __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_addEvent).call(this, event, starting_after);
    }
    if ((_a3 = stream.controller.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    return __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_endRequest).call(this);
  }
  [(_ResponseStream_params = /* @__PURE__ */ new WeakMap(), _ResponseStream_currentResponseSnapshot = /* @__PURE__ */ new WeakMap(), _ResponseStream_finalResponse = /* @__PURE__ */ new WeakMap(), _ResponseStream_instances = /* @__PURE__ */ new WeakSet(), _ResponseStream_beginRequest = function _ResponseStream_beginRequest2() {
    if (this.ended)
      return;
    __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, void 0, "f");
  }, _ResponseStream_addEvent = function _ResponseStream_addEvent2(event, starting_after) {
    if (this.ended)
      return;
    const maybeEmit = (name, event2) => {
      if (starting_after == null || event2.sequence_number > starting_after) {
        this._emit(name, event2);
      }
    };
    const response = __classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_accumulateResponse).call(this, event);
    maybeEmit("event", event);
    switch (event.type) {
      case "response.output_text.delta": {
        const output = response.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "message") {
          const content = output.content[event.content_index];
          if (!content) {
            throw new OpenAIError(`missing content at index ${event.content_index}`);
          }
          if (content.type !== "output_text") {
            throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
          }
          maybeEmit("response.output_text.delta", {
            ...event,
            snapshot: content.text
          });
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const output = response.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "function_call") {
          maybeEmit("response.function_call_arguments.delta", {
            ...event,
            snapshot: output.arguments
          });
        }
        break;
      }
      default:
        maybeEmit(event.type, event);
        break;
    }
  }, _ResponseStream_endRequest = function _ResponseStream_endRequest2() {
    if (this.ended) {
      throw new OpenAIError(`stream has ended, this shouldn't happen`);
    }
    const snapshot = __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
    if (!snapshot) {
      throw new OpenAIError(`request ended without sending any events`);
    }
    __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, void 0, "f");
    const parsedResponse = finalizeResponse(snapshot, __classPrivateFieldGet(this, _ResponseStream_params, "f"));
    __classPrivateFieldSet(this, _ResponseStream_finalResponse, parsedResponse, "f");
    return parsedResponse;
  }, _ResponseStream_accumulateResponse = function _ResponseStream_accumulateResponse2(event) {
    let snapshot = __classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
    if (!snapshot) {
      if (event.type !== "response.created") {
        throw new OpenAIError(`When snapshot hasn't been set yet, expected 'response.created' event, got ${event.type}`);
      }
      snapshot = __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
      return snapshot;
    }
    switch (event.type) {
      case "response.output_item.added": {
        snapshot.output.push(event.item);
        break;
      }
      case "response.content_part.added": {
        const output = snapshot.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "message") {
          output.content.push(event.part);
        }
        break;
      }
      case "response.output_text.delta": {
        const output = snapshot.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "message") {
          const content = output.content[event.content_index];
          if (!content) {
            throw new OpenAIError(`missing content at index ${event.content_index}`);
          }
          if (content.type !== "output_text") {
            throw new OpenAIError(`expected content to be 'output_text', got ${content.type}`);
          }
          content.text += event.delta;
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const output = snapshot.output[event.output_index];
        if (!output) {
          throw new OpenAIError(`missing output at index ${event.output_index}`);
        }
        if (output.type === "function_call") {
          output.arguments += event.delta;
        }
        break;
      }
      case "response.completed": {
        __classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
        break;
      }
    }
    return snapshot;
  }, Symbol.asyncIterator)]() {
    const pushQueue = [];
    const readQueue = [];
    let done = false;
    this.on("event", (event) => {
      const reader = readQueue.shift();
      if (reader) {
        reader.resolve(event);
      } else {
        pushQueue.push(event);
      }
    });
    this.on("end", () => {
      done = true;
      for (const reader of readQueue) {
        reader.resolve(void 0);
      }
      readQueue.length = 0;
    });
    this.on("abort", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    this.on("error", (err) => {
      done = true;
      for (const reader of readQueue) {
        reader.reject(err);
      }
      readQueue.length = 0;
    });
    return {
      next: async () => {
        if (!pushQueue.length) {
          if (done) {
            return { value: void 0, done: true };
          }
          return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((event2) => event2 ? { value: event2, done: false } : { value: void 0, done: true });
        }
        const event = pushQueue.shift();
        return { value: event, done: false };
      },
      return: async () => {
        this.abort();
        return { value: void 0, done: true };
      }
    };
  }
  /**
   * @returns a promise that resolves with the final Response, or rejects
   * if an error occurred or the stream ended prematurely without producing a REsponse.
   */
  async finalResponse() {
    await this.done();
    const response = __classPrivateFieldGet(this, _ResponseStream_finalResponse, "f");
    if (!response)
      throw new OpenAIError("stream ended without producing a ChatCompletion");
    return response;
  }
};
function finalizeResponse(snapshot, params) {
  return maybeParseResponse(snapshot, params);
}

// node_modules/openai/resources/responses/input-items.mjs
init_cjs_shims();
var InputItems = class extends APIResource {
  /**
   * Returns a list of input items for a given response.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const responseItem of client.responses.inputItems.list(
   *   'response_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(responseID, query = {}, options) {
    return this._client.getAPIList(path5`/responses/${responseID}/input_items`, CursorPage, { query, ...options });
  }
};

// node_modules/openai/resources/responses/responses.mjs
var Responses = class extends APIResource {
  constructor() {
    super(...arguments);
    this.inputItems = new InputItems(this._client);
  }
  create(body, options) {
    return this._client.post("/responses", { body, ...options, stream: body.stream ?? false })._thenUnwrap((rsp) => {
      if ("object" in rsp && rsp.object === "response") {
        addOutputText(rsp);
      }
      return rsp;
    });
  }
  retrieve(responseID, query = {}, options) {
    return this._client.get(path5`/responses/${responseID}`, {
      query,
      ...options,
      stream: (query == null ? void 0 : query.stream) ?? false
    })._thenUnwrap((rsp) => {
      if ("object" in rsp && rsp.object === "response") {
        addOutputText(rsp);
      }
      return rsp;
    });
  }
  /**
   * Deletes a model response with the given ID.
   *
   * @example
   * ```ts
   * await client.responses.delete(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  delete(responseID, options) {
    return this._client.delete(path5`/responses/${responseID}`, {
      ...options,
      headers: buildHeaders([{ Accept: "*/*" }, options == null ? void 0 : options.headers])
    });
  }
  parse(body, options) {
    return this._client.responses.create(body, options)._thenUnwrap((response) => parseResponse(response, body));
  }
  /**
   * Creates a model response stream
   */
  stream(body, options) {
    return ResponseStream.createResponse(this._client, body, options);
  }
  /**
   * Cancels a model response with the given ID. Only responses created with the
   * `background` parameter set to `true` can be cancelled.
   * [Learn more](https://platform.openai.com/docs/guides/background).
   *
   * @example
   * ```ts
   * const response = await client.responses.cancel(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  cancel(responseID, options) {
    return this._client.post(path5`/responses/${responseID}/cancel`, options);
  }
};
Responses.InputItems = InputItems;

// node_modules/openai/resources/uploads/uploads.mjs
init_cjs_shims();

// node_modules/openai/resources/uploads/parts.mjs
init_cjs_shims();
var Parts = class extends APIResource {
  /**
   * Adds a
   * [Part](https://platform.openai.com/docs/api-reference/uploads/part-object) to an
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object.
   * A Part represents a chunk of bytes from the file you are trying to upload.
   *
   * Each Part can be at most 64 MB, and you can add Parts until you hit the Upload
   * maximum of 8 GB.
   *
   * It is possible to add multiple Parts in parallel. You can decide the intended
   * order of the Parts when you
   * [complete the Upload](https://platform.openai.com/docs/api-reference/uploads/complete).
   */
  create(uploadID, body, options) {
    return this._client.post(path5`/uploads/${uploadID}/parts`, multipartFormRequestOptions({ body, ...options }, this._client));
  }
};

// node_modules/openai/resources/uploads/uploads.mjs
var Uploads = class extends APIResource {
  constructor() {
    super(...arguments);
    this.parts = new Parts(this._client);
  }
  /**
   * Creates an intermediate
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object
   * that you can add
   * [Parts](https://platform.openai.com/docs/api-reference/uploads/part-object) to.
   * Currently, an Upload can accept at most 8 GB in total and expires after an hour
   * after you create it.
   *
   * Once you complete the Upload, we will create a
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * contains all the parts you uploaded. This File is usable in the rest of our
   * platform as a regular File object.
   *
   * For certain `purpose` values, the correct `mime_type` must be specified. Please
   * refer to documentation for the
   * [supported MIME types for your use case](https://platform.openai.com/docs/assistants/tools/file-search#supported-files).
   *
   * For guidance on the proper filename extensions for each purpose, please follow
   * the documentation on
   * [creating a File](https://platform.openai.com/docs/api-reference/files/create).
   */
  create(body, options) {
    return this._client.post("/uploads", { body, ...options });
  }
  /**
   * Cancels the Upload. No Parts may be added after an Upload is cancelled.
   */
  cancel(uploadID, options) {
    return this._client.post(path5`/uploads/${uploadID}/cancel`, options);
  }
  /**
   * Completes the
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object).
   *
   * Within the returned Upload object, there is a nested
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * is ready to use in the rest of the platform.
   *
   * You can specify the order of the Parts by passing in an ordered list of the Part
   * IDs.
   *
   * The number of bytes uploaded upon completion must match the number of bytes
   * initially specified when creating the Upload object. No Parts may be added after
   * an Upload is completed.
   */
  complete(uploadID, body, options) {
    return this._client.post(path5`/uploads/${uploadID}/complete`, { body, ...options });
  }
};
Uploads.Parts = Parts;

// node_modules/openai/resources/vector-stores/vector-stores.mjs
init_cjs_shims();

// node_modules/openai/resources/vector-stores/file-batches.mjs
init_cjs_shims();

// node_modules/openai/lib/Util.mjs
init_cjs_shims();
var allSettledWithThrow = async (promises) => {
  const results = await Promise.allSettled(promises);
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    for (const result of rejected) {
      console.error(result.reason);
    }
    throw new Error(`${rejected.length} promise(s) failed - see the above errors`);
  }
  const values = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      values.push(result.value);
    }
  }
  return values;
};

// node_modules/openai/resources/vector-stores/file-batches.mjs
var FileBatches = class extends APIResource {
  /**
   * Create a vector store file batch.
   */
  create(vectorStoreID, body, options) {
    return this._client.post(path5`/vector_stores/${vectorStoreID}/file_batches`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Retrieves a vector store file batch.
   */
  retrieve(batchID, params, options) {
    const { vector_store_id } = params;
    return this._client.get(path5`/vector_stores/${vector_store_id}/file_batches/${batchID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Cancel a vector store file batch. This attempts to cancel the processing of
   * files in this batch as soon as possible.
   */
  cancel(batchID, params, options) {
    const { vector_store_id } = params;
    return this._client.post(path5`/vector_stores/${vector_store_id}/file_batches/${batchID}/cancel`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Create a vector store batch and poll until all files have been processed.
   */
  async createAndPoll(vectorStoreId, body, options) {
    const batch = await this.create(vectorStoreId, body);
    return await this.poll(vectorStoreId, batch.id, options);
  }
  /**
   * Returns a list of vector store files in a batch.
   */
  listFiles(batchID, params, options) {
    const { vector_store_id, ...query } = params;
    return this._client.getAPIList(path5`/vector_stores/${vector_store_id}/file_batches/${batchID}/files`, CursorPage, { query, ...options, headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers]) });
  }
  /**
   * Wait for the given file batch to be processed.
   *
   * Note: this will return even if one of the files failed to process, you need to
   * check batch.file_counts.failed_count to handle this case.
   */
  async poll(vectorStoreID, batchID, options) {
    var _a3;
    const headers = buildHeaders([
      options == null ? void 0 : options.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": ((_a3 = options == null ? void 0 : options.pollIntervalMs) == null ? void 0 : _a3.toString()) ?? void 0
      }
    ]);
    while (true) {
      const { data: batch, response } = await this.retrieve(batchID, { vector_store_id: vectorStoreID }, {
        ...options,
        headers
      }).withResponse();
      switch (batch.status) {
        case "in_progress":
          let sleepInterval = 5e3;
          if (options == null ? void 0 : options.pollIntervalMs) {
            sleepInterval = options.pollIntervalMs;
          } else {
            const headerInterval = response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        case "failed":
        case "cancelled":
        case "completed":
          return batch;
      }
    }
  }
  /**
   * Uploads the given files concurrently and then creates a vector store file batch.
   *
   * The concurrency limit is configurable using the `maxConcurrency` parameter.
   */
  async uploadAndPoll(vectorStoreId, { files, fileIds = [] }, options) {
    if (files == null || files.length == 0) {
      throw new Error(`No \`files\` provided to process. If you've already uploaded files you should use \`.createAndPoll()\` instead`);
    }
    const configuredConcurrency = (options == null ? void 0 : options.maxConcurrency) ?? 5;
    const concurrencyLimit = Math.min(configuredConcurrency, files.length);
    const client = this._client;
    const fileIterator = files.values();
    const allFileIds = [...fileIds];
    async function processFiles(iterator) {
      for (let item of iterator) {
        const fileObj = await client.files.create({ file: item, purpose: "assistants" }, options);
        allFileIds.push(fileObj.id);
      }
    }
    const workers = Array(concurrencyLimit).fill(fileIterator).map(processFiles);
    await allSettledWithThrow(workers);
    return await this.createAndPoll(vectorStoreId, {
      file_ids: allFileIds
    });
  }
};

// node_modules/openai/resources/vector-stores/files.mjs
init_cjs_shims();
var Files3 = class extends APIResource {
  /**
   * Create a vector store file by attaching a
   * [File](https://platform.openai.com/docs/api-reference/files) to a
   * [vector store](https://platform.openai.com/docs/api-reference/vector-stores/object).
   */
  create(vectorStoreID, body, options) {
    return this._client.post(path5`/vector_stores/${vectorStoreID}/files`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Retrieves a vector store file.
   */
  retrieve(fileID, params, options) {
    const { vector_store_id } = params;
    return this._client.get(path5`/vector_stores/${vector_store_id}/files/${fileID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Update attributes on a vector store file.
   */
  update(fileID, params, options) {
    const { vector_store_id, ...body } = params;
    return this._client.post(path5`/vector_stores/${vector_store_id}/files/${fileID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Returns a list of vector store files.
   */
  list(vectorStoreID, query = {}, options) {
    return this._client.getAPIList(path5`/vector_stores/${vectorStoreID}/files`, CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Delete a vector store file. This will remove the file from the vector store but
   * the file itself will not be deleted. To delete the file, use the
   * [delete file](https://platform.openai.com/docs/api-reference/files/delete)
   * endpoint.
   */
  delete(fileID, params, options) {
    const { vector_store_id } = params;
    return this._client.delete(path5`/vector_stores/${vector_store_id}/files/${fileID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Attach a file to the given vector store and wait for it to be processed.
   */
  async createAndPoll(vectorStoreId, body, options) {
    const file = await this.create(vectorStoreId, body, options);
    return await this.poll(vectorStoreId, file.id, options);
  }
  /**
   * Wait for the vector store file to finish processing.
   *
   * Note: this will return even if the file failed to process, you need to check
   * file.last_error and file.status to handle these cases
   */
  async poll(vectorStoreID, fileID, options) {
    var _a3;
    const headers = buildHeaders([
      options == null ? void 0 : options.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": ((_a3 = options == null ? void 0 : options.pollIntervalMs) == null ? void 0 : _a3.toString()) ?? void 0
      }
    ]);
    while (true) {
      const fileResponse = await this.retrieve(fileID, {
        vector_store_id: vectorStoreID
      }, { ...options, headers }).withResponse();
      const file = fileResponse.data;
      switch (file.status) {
        case "in_progress":
          let sleepInterval = 5e3;
          if (options == null ? void 0 : options.pollIntervalMs) {
            sleepInterval = options.pollIntervalMs;
          } else {
            const headerInterval = fileResponse.response.headers.get("openai-poll-after-ms");
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        case "failed":
        case "completed":
          return file;
      }
    }
  }
  /**
   * Upload a file to the `files` API and then attach it to the given vector store.
   *
   * Note the file will be asynchronously processed (you can use the alternative
   * polling helper method to wait for processing to complete).
   */
  async upload(vectorStoreId, file, options) {
    const fileInfo = await this._client.files.create({ file, purpose: "assistants" }, options);
    return this.create(vectorStoreId, { file_id: fileInfo.id }, options);
  }
  /**
   * Add a file to a vector store and poll until processing is complete.
   */
  async uploadAndPoll(vectorStoreId, file, options) {
    const fileInfo = await this.upload(vectorStoreId, file, options);
    return await this.poll(vectorStoreId, fileInfo.id, options);
  }
  /**
   * Retrieve the parsed contents of a vector store file.
   */
  content(fileID, params, options) {
    const { vector_store_id } = params;
    return this._client.getAPIList(path5`/vector_stores/${vector_store_id}/files/${fileID}/content`, Page, { ...options, headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers]) });
  }
};

// node_modules/openai/resources/vector-stores/vector-stores.mjs
var VectorStores = class extends APIResource {
  constructor() {
    super(...arguments);
    this.files = new Files3(this._client);
    this.fileBatches = new FileBatches(this._client);
  }
  /**
   * Create a vector store.
   */
  create(body, options) {
    return this._client.post("/vector_stores", {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Retrieves a vector store.
   */
  retrieve(vectorStoreID, options) {
    return this._client.get(path5`/vector_stores/${vectorStoreID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Modifies a vector store.
   */
  update(vectorStoreID, body, options) {
    return this._client.post(path5`/vector_stores/${vectorStoreID}`, {
      body,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Returns a list of vector stores.
   */
  list(query = {}, options) {
    return this._client.getAPIList("/vector_stores", CursorPage, {
      query,
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Delete a vector store.
   */
  delete(vectorStoreID, options) {
    return this._client.delete(path5`/vector_stores/${vectorStoreID}`, {
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
  /**
   * Search a vector store for relevant chunks based on a query and file attributes
   * filter.
   */
  search(vectorStoreID, body, options) {
    return this._client.getAPIList(path5`/vector_stores/${vectorStoreID}/search`, Page, {
      body,
      method: "post",
      ...options,
      headers: buildHeaders([{ "OpenAI-Beta": "assistants=v2" }, options == null ? void 0 : options.headers])
    });
  }
};
VectorStores.Files = Files3;
VectorStores.FileBatches = FileBatches;

// node_modules/openai/resources/webhooks.mjs
init_cjs_shims();
var _Webhooks_instances;
var _Webhooks_validateSecret;
var _Webhooks_getRequiredHeader;
var Webhooks = class extends APIResource {
  constructor() {
    super(...arguments);
    _Webhooks_instances.add(this);
  }
  /**
   * Validates that the given payload was sent by OpenAI and parses the payload.
   */
  async unwrap(payload, headers, secret = this._client.webhookSecret, tolerance = 300) {
    await this.verifySignature(payload, headers, secret, tolerance);
    return JSON.parse(payload);
  }
  /**
   * Validates whether or not the webhook payload was sent by OpenAI.
   *
   * An error will be raised if the webhook payload was not sent by OpenAI.
   *
   * @param payload - The webhook payload
   * @param headers - The webhook headers
   * @param secret - The webhook secret (optional, will use client secret if not provided)
   * @param tolerance - Maximum age of the webhook in seconds (default: 300 = 5 minutes)
   */
  async verifySignature(payload, headers, secret = this._client.webhookSecret, tolerance = 300) {
    if (typeof crypto === "undefined" || typeof crypto.subtle.importKey !== "function" || typeof crypto.subtle.verify !== "function") {
      throw new Error("Webhook signature verification is only supported when the `crypto` global is defined");
    }
    __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_validateSecret).call(this, secret);
    const headersObj = buildHeaders([headers]).values;
    const signatureHeader = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-signature");
    const timestamp = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-timestamp");
    const webhookId = __classPrivateFieldGet(this, _Webhooks_instances, "m", _Webhooks_getRequiredHeader).call(this, headersObj, "webhook-id");
    const timestampSeconds = parseInt(timestamp, 10);
    if (isNaN(timestampSeconds)) {
      throw new InvalidWebhookSignatureError("Invalid webhook timestamp format");
    }
    const nowSeconds = Math.floor(Date.now() / 1e3);
    if (nowSeconds - timestampSeconds > tolerance) {
      throw new InvalidWebhookSignatureError("Webhook timestamp is too old");
    }
    if (timestampSeconds > nowSeconds + tolerance) {
      throw new InvalidWebhookSignatureError("Webhook timestamp is too new");
    }
    const signatures = signatureHeader.split(" ").map((part) => part.startsWith("v1,") ? part.substring(3) : part);
    const decodedSecret = secret.startsWith("whsec_") ? Buffer.from(secret.replace("whsec_", ""), "base64") : Buffer.from(secret, "utf-8");
    const signedPayload = webhookId ? `${webhookId}.${timestamp}.${payload}` : `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey("raw", decodedSecret, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    for (const signature of signatures) {
      try {
        const signatureBytes = Buffer.from(signature, "base64");
        const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(signedPayload));
        if (isValid) {
          return;
        }
      } catch {
        continue;
      }
    }
    throw new InvalidWebhookSignatureError("The given webhook signature does not match the expected signature");
  }
};
_Webhooks_instances = /* @__PURE__ */ new WeakSet(), _Webhooks_validateSecret = function _Webhooks_validateSecret2(secret) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error(`The webhook secret must either be set using the env var, OPENAI_WEBHOOK_SECRET, on the client class, OpenAI({ webhookSecret: '123' }), or passed to this function`);
  }
}, _Webhooks_getRequiredHeader = function _Webhooks_getRequiredHeader2(headers, name) {
  if (!headers) {
    throw new Error(`Headers are required`);
  }
  const value = headers.get(name);
  if (value === null || value === void 0) {
    throw new Error(`Missing required header: ${name}`);
  }
  return value;
};

// node_modules/openai/client.mjs
var _OpenAI_instances;
var _a2;
var _OpenAI_encoder;
var _OpenAI_baseURLOverridden;
var OpenAI = class {
  /**
   * API Client for interfacing with the OpenAI API.
   *
   * @param {string | undefined} [opts.apiKey=process.env['OPENAI_API_KEY'] ?? undefined]
   * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
   * @param {string | null | undefined} [opts.project=process.env['OPENAI_PROJECT_ID'] ?? null]
   * @param {string | null | undefined} [opts.webhookSecret=process.env['OPENAI_WEBHOOK_SECRET'] ?? null]
   * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL'] ?? https://api.openai.com/v1] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({ baseURL = readEnv("OPENAI_BASE_URL"), apiKey = readEnv("OPENAI_API_KEY"), organization = readEnv("OPENAI_ORG_ID") ?? null, project = readEnv("OPENAI_PROJECT_ID") ?? null, webhookSecret = readEnv("OPENAI_WEBHOOK_SECRET") ?? null, ...opts } = {}) {
    _OpenAI_instances.add(this);
    _OpenAI_encoder.set(this, void 0);
    this.completions = new Completions2(this);
    this.chat = new Chat(this);
    this.embeddings = new Embeddings(this);
    this.files = new Files2(this);
    this.images = new Images(this);
    this.audio = new Audio(this);
    this.moderations = new Moderations(this);
    this.models = new Models(this);
    this.fineTuning = new FineTuning(this);
    this.graders = new Graders2(this);
    this.vectorStores = new VectorStores(this);
    this.webhooks = new Webhooks(this);
    this.beta = new Beta(this);
    this.batches = new Batches(this);
    this.uploads = new Uploads(this);
    this.responses = new Responses(this);
    this.evals = new Evals(this);
    this.containers = new Containers(this);
    if (apiKey === void 0) {
      throw new OpenAIError("The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' }).");
    }
    const options = {
      apiKey,
      organization,
      project,
      webhookSecret,
      ...opts,
      baseURL: baseURL || `https://api.openai.com/v1`
    };
    if (!options.dangerouslyAllowBrowser && isRunningInBrowser()) {
      throw new OpenAIError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew OpenAI({ apiKey, dangerouslyAllowBrowser: true });\n\nhttps://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety\n");
    }
    this.baseURL = options.baseURL;
    this.timeout = options.timeout ?? _a2.DEFAULT_TIMEOUT;
    this.logger = options.logger ?? console;
    const defaultLogLevel = "warn";
    this.logLevel = defaultLogLevel;
    this.logLevel = parseLogLevel(options.logLevel, "ClientOptions.logLevel", this) ?? parseLogLevel(readEnv("OPENAI_LOG"), "process.env['OPENAI_LOG']", this) ?? defaultLogLevel;
    this.fetchOptions = options.fetchOptions;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetch = options.fetch ?? getDefaultFetch();
    __classPrivateFieldSet(this, _OpenAI_encoder, FallbackEncoder, "f");
    this._options = options;
    this.apiKey = apiKey;
    this.organization = organization;
    this.project = project;
    this.webhookSecret = webhookSecret;
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(options) {
    const client = new this.constructor({
      ...this._options,
      baseURL: this.baseURL,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      apiKey: this.apiKey,
      organization: this.organization,
      project: this.project,
      webhookSecret: this.webhookSecret,
      ...options
    });
    return client;
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values, nulls }) {
    return;
  }
  async authHeaders(opts) {
    return buildHeaders([{ Authorization: `Bearer ${this.apiKey}` }]);
  }
  stringifyQuery(query) {
    return stringify(query, { arrayFormat: "brackets" });
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${VERSION}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${uuid4()}`;
  }
  makeStatusError(status, error, message, headers) {
    return APIError.generate(status, error, message, headers);
  }
  buildURL(path11, query, defaultBaseURL) {
    const baseURL = !__classPrivateFieldGet(this, _OpenAI_instances, "m", _OpenAI_baseURLOverridden).call(this) && defaultBaseURL || this.baseURL;
    const url = isAbsoluteURL(path11) ? new URL(path11) : new URL(baseURL + (baseURL.endsWith("/") && path11.startsWith("/") ? path11.slice(1) : path11));
    const defaultQuery = this.defaultQuery();
    if (!isEmptyObj(defaultQuery)) {
      query = { ...defaultQuery, ...query };
    }
    if (typeof query === "object" && query && !Array.isArray(query)) {
      url.search = this.stringifyQuery(query);
    }
    return url.toString();
  }
  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  async prepareOptions(options) {
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(request, { url, options }) {
  }
  get(path11, opts) {
    return this.methodRequest("get", path11, opts);
  }
  post(path11, opts) {
    return this.methodRequest("post", path11, opts);
  }
  patch(path11, opts) {
    return this.methodRequest("patch", path11, opts);
  }
  put(path11, opts) {
    return this.methodRequest("put", path11, opts);
  }
  delete(path11, opts) {
    return this.methodRequest("delete", path11, opts);
  }
  methodRequest(method, path11, opts) {
    return this.request(Promise.resolve(opts).then((opts2) => {
      return { method, path: path11, ...opts2 };
    }));
  }
  request(options, remainingRetries = null) {
    return new APIPromise(this, this.makeRequest(options, remainingRetries, void 0));
  }
  async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
    var _a3, _b;
    const options = await optionsInput;
    const maxRetries = options.maxRetries ?? this.maxRetries;
    if (retriesRemaining == null) {
      retriesRemaining = maxRetries;
    }
    await this.prepareOptions(options);
    const { req, url, timeout } = await this.buildRequest(options, {
      retryCount: maxRetries - retriesRemaining
    });
    await this.prepareRequest(req, { url, options });
    const requestLogID = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0");
    const retryLogStr = retryOfRequestLogID === void 0 ? "" : `, retryOf: ${retryOfRequestLogID}`;
    const startTime = Date.now();
    loggerFor(this).debug(`[${requestLogID}] sending request`, formatRequestDetails({
      retryOfRequestLogID,
      method: options.method,
      url,
      options,
      headers: req.headers
    }));
    if ((_a3 = options.signal) == null ? void 0 : _a3.aborted) {
      throw new APIUserAbortError();
    }
    const controller = new AbortController();
    const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
    const headersTime = Date.now();
    if (response instanceof Error) {
      const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
      if ((_b = options.signal) == null ? void 0 : _b.aborted) {
        throw new APIUserAbortError();
      }
      const isTimeout = isAbortError(response) || /timed? ?out/i.test(String(response) + ("cause" in response ? String(response.cause) : ""));
      if (retriesRemaining) {
        loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${retryMessage}`);
        loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${retryMessage})`, formatRequestDetails({
          retryOfRequestLogID,
          url,
          durationMs: headersTime - startTime,
          message: response.message
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
      }
      loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - error; no more retries left`);
      loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (error; no more retries left)`, formatRequestDetails({
        retryOfRequestLogID,
        url,
        durationMs: headersTime - startTime,
        message: response.message
      }));
      if (isTimeout) {
        throw new APIConnectionTimeoutError();
      }
      throw new APIConnectionError({ cause: response });
    }
    const specialHeaders = [...response.headers.entries()].filter(([name]) => name === "x-request-id").map(([name, value]) => ", " + name + ": " + JSON.stringify(value)).join("");
    const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${response.ok ? "succeeded" : "failed"} with status ${response.status} in ${headersTime - startTime}ms`;
    if (!response.ok) {
      const shouldRetry = await this.shouldRetry(response);
      if (retriesRemaining && shouldRetry) {
        const retryMessage2 = `retrying, ${retriesRemaining} attempts remaining`;
        await CancelReadableStream(response.body);
        loggerFor(this).info(`${responseInfo} - ${retryMessage2}`);
        loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage2})`, formatRequestDetails({
          retryOfRequestLogID,
          url: response.url,
          status: response.status,
          headers: response.headers,
          durationMs: headersTime - startTime
        }));
        return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
      }
      const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
      loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
      const errText = await response.text().catch((err2) => castToError(err2).message);
      const errJSON = safeJSON(errText);
      const errMessage = errJSON ? void 0 : errText;
      loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        headers: response.headers,
        message: errMessage,
        durationMs: Date.now() - startTime
      }));
      const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
      throw err;
    }
    loggerFor(this).info(responseInfo);
    loggerFor(this).debug(`[${requestLogID}] response start`, formatRequestDetails({
      retryOfRequestLogID,
      url: response.url,
      status: response.status,
      headers: response.headers,
      durationMs: headersTime - startTime
    }));
    return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
  }
  getAPIList(path11, Page2, opts) {
    return this.requestAPIList(Page2, { method: "get", path: path11, ...opts });
  }
  requestAPIList(Page2, options) {
    const request = this.makeRequest(options, null, void 0);
    return new PagePromise(this, request, Page2);
  }
  async fetchWithTimeout(url, init, ms, controller) {
    const { signal, method, ...options } = init || {};
    if (signal)
      signal.addEventListener("abort", () => controller.abort());
    const timeout = setTimeout(() => controller.abort(), ms);
    const isReadableBody = globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream || typeof options.body === "object" && options.body !== null && Symbol.asyncIterator in options.body;
    const fetchOptions = {
      signal: controller.signal,
      ...isReadableBody ? { duplex: "half" } : {},
      method: "GET",
      ...options
    };
    if (method) {
      fetchOptions.method = method.toUpperCase();
    }
    try {
      return await this.fetch.call(void 0, url, fetchOptions);
    } finally {
      clearTimeout(timeout);
    }
  }
  async shouldRetry(response) {
    const shouldRetryHeader = response.headers.get("x-should-retry");
    if (shouldRetryHeader === "true")
      return true;
    if (shouldRetryHeader === "false")
      return false;
    if (response.status === 408)
      return true;
    if (response.status === 409)
      return true;
    if (response.status === 429)
      return true;
    if (response.status >= 500)
      return true;
    return false;
  }
  async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
    let timeoutMillis;
    const retryAfterMillisHeader = responseHeaders == null ? void 0 : responseHeaders.get("retry-after-ms");
    if (retryAfterMillisHeader) {
      const timeoutMs = parseFloat(retryAfterMillisHeader);
      if (!Number.isNaN(timeoutMs)) {
        timeoutMillis = timeoutMs;
      }
    }
    const retryAfterHeader = responseHeaders == null ? void 0 : responseHeaders.get("retry-after");
    if (retryAfterHeader && !timeoutMillis) {
      const timeoutSeconds = parseFloat(retryAfterHeader);
      if (!Number.isNaN(timeoutSeconds)) {
        timeoutMillis = timeoutSeconds * 1e3;
      } else {
        timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
      }
    }
    if (!(timeoutMillis && 0 <= timeoutMillis && timeoutMillis < 60 * 1e3)) {
      const maxRetries = options.maxRetries ?? this.maxRetries;
      timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
    }
    await sleep(timeoutMillis);
    return this.makeRequest(options, retriesRemaining - 1, requestLogID);
  }
  calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
    const initialRetryDelay = 0.5;
    const maxRetryDelay = 8;
    const numRetries = maxRetries - retriesRemaining;
    const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
    const jitter = 1 - Math.random() * 0.25;
    return sleepSeconds * jitter * 1e3;
  }
  async buildRequest(inputOptions, { retryCount = 0 } = {}) {
    const options = { ...inputOptions };
    const { method, path: path11, query, defaultBaseURL } = options;
    const url = this.buildURL(path11, query, defaultBaseURL);
    if ("timeout" in options)
      validatePositiveInteger("timeout", options.timeout);
    options.timeout = options.timeout ?? this.timeout;
    const { bodyHeaders, body } = this.buildBody({ options });
    const reqHeaders = await this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });
    const req = {
      method,
      headers: reqHeaders,
      ...options.signal && { signal: options.signal },
      ...globalThis.ReadableStream && body instanceof globalThis.ReadableStream && { duplex: "half" },
      ...body && { body },
      ...this.fetchOptions ?? {},
      ...options.fetchOptions ?? {}
    };
    return { req, url, timeout: options.timeout };
  }
  async buildHeaders({ options, method, bodyHeaders, retryCount }) {
    let idempotencyHeaders = {};
    if (this.idempotencyHeader && method !== "get") {
      if (!options.idempotencyKey)
        options.idempotencyKey = this.defaultIdempotencyKey();
      idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
    }
    const headers = buildHeaders([
      idempotencyHeaders,
      {
        Accept: "application/json",
        "User-Agent": this.getUserAgent(),
        "X-Stainless-Retry-Count": String(retryCount),
        ...options.timeout ? { "X-Stainless-Timeout": String(Math.trunc(options.timeout / 1e3)) } : {},
        ...getPlatformHeaders(),
        "OpenAI-Organization": this.organization,
        "OpenAI-Project": this.project
      },
      await this.authHeaders(options),
      this._options.defaultHeaders,
      bodyHeaders,
      options.headers
    ]);
    this.validateHeaders(headers);
    return headers.values;
  }
  buildBody({ options: { body, headers: rawHeaders } }) {
    if (!body) {
      return { bodyHeaders: void 0, body: void 0 };
    }
    const headers = buildHeaders([rawHeaders]);
    if (
      // Pass raw type verbatim
      ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof DataView || typeof body === "string" && // Preserve legacy string encoding behavior for now
      headers.values.has("content-type") || // `Blob` is superset of `File`
      body instanceof Blob || // `FormData` -> `multipart/form-data`
      body instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      body instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && body instanceof globalThis.ReadableStream
    ) {
      return { bodyHeaders: void 0, body };
    } else if (typeof body === "object" && (Symbol.asyncIterator in body || Symbol.iterator in body && "next" in body && typeof body.next === "function")) {
      return { bodyHeaders: void 0, body: ReadableStreamFrom(body) };
    } else {
      return __classPrivateFieldGet(this, _OpenAI_encoder, "f").call(this, { body, headers });
    }
  }
};
_a2 = OpenAI, _OpenAI_encoder = /* @__PURE__ */ new WeakMap(), _OpenAI_instances = /* @__PURE__ */ new WeakSet(), _OpenAI_baseURLOverridden = function _OpenAI_baseURLOverridden2() {
  return this.baseURL !== "https://api.openai.com/v1";
};
OpenAI.OpenAI = _a2;
OpenAI.DEFAULT_TIMEOUT = 6e5;
OpenAI.OpenAIError = OpenAIError;
OpenAI.APIError = APIError;
OpenAI.APIConnectionError = APIConnectionError;
OpenAI.APIConnectionTimeoutError = APIConnectionTimeoutError;
OpenAI.APIUserAbortError = APIUserAbortError;
OpenAI.NotFoundError = NotFoundError;
OpenAI.ConflictError = ConflictError;
OpenAI.RateLimitError = RateLimitError;
OpenAI.BadRequestError = BadRequestError;
OpenAI.AuthenticationError = AuthenticationError;
OpenAI.InternalServerError = InternalServerError;
OpenAI.PermissionDeniedError = PermissionDeniedError;
OpenAI.UnprocessableEntityError = UnprocessableEntityError;
OpenAI.InvalidWebhookSignatureError = InvalidWebhookSignatureError;
OpenAI.toFile = toFile;
OpenAI.Completions = Completions2;
OpenAI.Chat = Chat;
OpenAI.Embeddings = Embeddings;
OpenAI.Files = Files2;
OpenAI.Images = Images;
OpenAI.Audio = Audio;
OpenAI.Moderations = Moderations;
OpenAI.Models = Models;
OpenAI.FineTuning = FineTuning;
OpenAI.Graders = Graders2;
OpenAI.VectorStores = VectorStores;
OpenAI.Webhooks = Webhooks;
OpenAI.Beta = Beta;
OpenAI.Batches = Batches;
OpenAI.Uploads = Uploads;
OpenAI.Responses = Responses;
OpenAI.Evals = Evals;
OpenAI.Containers = Containers;

// node_modules/openai/azure.mjs
init_cjs_shims();

// src/agent/task_planner.ts
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
  try {
    const list = await client.models.list();
    const names = list.data.map((m) => m.id);
    const preferred = names.find((n) => n.includes("gpt-oss")) || names.find((n) => n.includes("20b")) || names.find((n) => n.includes("llama")) || names[0];
    if (preferred) return preferred;
  } catch {
  }
  return "local-model";
}
function detectLocateTask(prompt) {
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
  const patterns = [
    // Direct requests
    /where\s+is\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /find\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
    /locate\s+(?:the\s+)?(?:file|folder)?\s*(?:named\s+)?["']?(.+?)["']?(?:\s+on\s+(my\s+)?(desktop|documents|downloads|laptop|computer|mac))?\??$/i,
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
  const listFolders = p.match(/\b(list|show|find)\s+(?:all\s+)?(folders|directories)\s+(?:on\s+the\s+)?(desktop|documents|downloads|pictures)\b/i);
  if (listFolders) {
    const scope = (listFolders[3] || "any").toLowerCase();
    const payload = { op: "locate", name: "*", scope, listType: "folders" };
    return [{ id: "locate", title: "List folders", description: JSON.stringify(payload), role: "fileops", deps: [], budgets: {} }];
  }
  const listFiles = p.match(/\b(list|show)\s+(?:all\s+)?files\s+(?:on\s+the\s+)?(desktop|documents|downloads|pictures)\b/i);
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
  var _a3, _b;
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
  const taskFocus = automation ? "Mac control, file operations, shell commands, browser automation" : "web research, information gathering, analysis, synthesis";
  const preferredRoles = automation ? "fileops (local file edits), shell (terminal commands), automation (browser/app control)" : "research (web), reviewer (analysis), fileops (summary writing)";
  const system = `You are a local orchestrator that breaks a single user task into a small DAG of concrete steps.
Return 2-5 tasks max, each with an id, title, description, role, deps (by id), and tiny budgets.

${automation ? "TASK MODE" : "RESEARCH MODE"}: Focus on ${taskFocus}.
Use roles: ${preferredRoles}. Prefer reversible steps first.

${automation ? "For task mode: Prioritize direct actions like file operations, shell commands, opening apps, browser automation." : "For research mode: Prioritize web research, data gathering, analysis, and report generation."}

Respond with valid JSON only, no other text.`;
  const baseURL = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
  const client = new OpenAI({
    baseURL,
    apiKey: "not-needed"
  });
  let res;
  let modelName = modelOverride ?? await selectModel(client);
  try {
    res = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });
  } catch (e) {
    modelName = "local-model";
    res = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300
    });
  }
  let tasks = [];
  try {
    const text = ((_b = (_a3 = res.choices[0]) == null ? void 0 : _a3.message) == null ? void 0 : _b.content) ?? "";
    const parsed = JSON.parse(text);
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
  var _a3, _b, _c, _d, _e;
  db.addRunEvent(state.runId ?? "", { type: "graph_synthesize_start", message: "Synthesizing final report" });
  const baseURL = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
  async function getFetch2() {
    const g = globalThis;
    if (typeof g.fetch === "function") return g.fetch.bind(globalThis);
    const mod = await import("node-fetch");
    return mod.default;
  }
  let model = process.env.LMSTUDIO_MODEL ?? "local-model";
  try {
    const doFetch2 = await getFetch2();
    const resp = await doFetch2(baseURL.replace(/\/$/, "") + "/models");
    if (resp.ok) {
      const data = await resp.json();
      model = ((_b = (_a3 = data == null ? void 0 : data.data) == null ? void 0 : _a3[0]) == null ? void 0 : _b.id) ?? model;
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
async function startOrchestrator(input) {
  const controller = new AbortController();
  activeRuns.set(input.runId, controller);
  try {
    const tasks = await planTasks(input.prompt, input.model, input.deep, input.automation);
    db.addRunEvent(input.runId, { type: "plan", tasks });
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
      await Promise.all(wave.map((t) => executeTask(t, input, controller.signal)));
      for (const t of wave) done.add(t.id);
    }
    db.completeRun(input.runId);
  } finally {
    activeRuns.delete(input.runId);
  }
}
async function executeTask(task, ctx, signal) {
  const { runId, sessionId } = ctx;
  db.updateTaskStatus(runId, task.id, "running", { title: task.title, role: task.role });
  db.addRunEvent(runId, { type: "task_start", taskId: task.id, title: task.title, role: task.role });
  try {
    let result;
    switch (task.role) {
      case "research":
        result = await spawnResearchAgent({ runId, sessionId, task, query: ctx.prompt, deep: ctx.deep, signal });
        break;
      case "fileops":
        result = await spawnFileOpsAgent({ runId, sessionId, task, automation: ctx.automation, signal });
        break;
      case "shell":
        result = await spawnShellAgent({ runId, sessionId, task, automation: ctx.automation });
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
    const r = await fetch(this.baseURL.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: (opts == null ? void 0 : opts.temperature) ?? 0.7, stream: Boolean(opts == null ? void 0 : opts.stream) })
    });
    return r;
  }
};
function createAgentRuntime(ipcMain2) {
  async function detectChatIntent(_client, _modelName, text) {
    var _a3, _b, _c;
    try {
      const sys = 'You are an intent router. Return strict JSON only with fields: {"action": "answer|quick_web|open_url|summarize_url|to_tasks|to_research", "query?": string, "url?": string}. Choose quick_web for lightweight web lookup; to_research only if the user explicitly requests deep research.';
      const baseURL = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
      const client = new LMClient(baseURL);
      const r = await client.chat([
        { role: "system", content: sys },
        { role: "user", content: text }
      ], _modelName, { temperature: 0 });
      const j = await r.json();
      const content = ((_c = (_b = (_a3 = j == null ? void 0 : j.choices) == null ? void 0 : _a3[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) ?? "{}";
      const parsed = JSON.parse(content);
      if (typeof (parsed == null ? void 0 : parsed.action) === "string") return parsed;
    } catch {
    }
    return { action: "answer" };
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
    const chosenModel = input.model ?? getDefaultModel() ?? process.env.LMSTUDIO_MODEL ?? "local-model";
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
    var _a3, _b, _c, _d;
    const searchEnabled = input.searchEnabled !== false;
    const showThinking = input.showThinking !== false;
    try {
      const baseURL = process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234/v1";
      const client = new LMClient(baseURL);
      let modelName = input.model ?? "gpt-oss:20b";
      if (!input.model) {
        try {
          const models = await client.listModels();
          modelName = models.find((m) => m.includes("gpt-oss")) ?? models.find((m) => m.includes("custom-test")) ?? models[0] ?? "gpt-oss:20b";
        } catch {
          modelName = "gpt-oss:20b";
        }
      }
      const chatGuard = [
        'You are Local Agent in Chat mode. You may use the provided "Web context (short)" if present, but you do not browse live.',
        "Never output tool-call markup or channel tags. Cite web sources using Markdown links when you rely on the web context.",
        'When helpful, start with a single line: "Reasoning (concise): ..." followed by the answer.'
      ].join(" ");
      const userText = ((_a3 = input.messages.slice().reverse().find((m) => m.role === "user")) == null ? void 0 : _a3.content) ?? "";
      const intent = searchEnabled ? await detectChatIntent(client, modelName, userText) : { action: "answer" };
      const quickRegex = /\b(search|look up|find|news|latest|open|go to|happen|happened|going on|events|today|this week|this weekend|over the weekend)\b/i;
      const wantsQuick = searchEnabled && (intent.action === "quick_web" || intent.action === "summarize_url" || intent.action === "open_url" || quickRegex.test(userText) || /https?:\/\//i.test(userText));
      let quickContext;
      let quickHits;
      if (wantsQuick) {
        try {
          const urlFromIntent = intent.url && /^https?:\/\//i.test(intent.url) ? intent.url : void 0;
          const urlMatch = urlFromIntent ? [urlFromIntent] : userText.match(/https?:\/\/\S+/);
          if (urlMatch) {
            const readable = await fetchReadable(urlMatch[0]);
            if (readable) quickContext = `Source ${urlMatch[0]}

${readable}`;
            quickHits = [{ title: urlMatch[0], url: urlMatch[0] }];
          } else {
            const q = intent.query || userText.replace(/^\s*(?:please\s*)?(?:search|look up|find|check)\s*/i, "").trim();
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
      const reasoningHint = `reasoning: ${rl}`;
      const systemIdx = guardedMessages.findIndex((m) => m.role === "system");
      if (systemIdx >= 0) guardedMessages[systemIdx] = { role: "system", content: guardedMessages[systemIdx].content + `
${reasoningHint}` };
      const resp = await client.chat(guardedMessages, modelName, { temperature: input.temperature ?? (rl === "high" ? 0.2 : rl === "low" ? 0.8 : 0.6), stream: false });
      const jj = await resp.json();
      const contentAll = ((_d = (_c = (_b = jj == null ? void 0 : jj.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) ?? "";
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
        thinking: showThinking ? extract.thinking : ""
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        content: `Sorry, I encountered an error connecting to LM Studio. Please make sure LM Studio is running and the local server is started on ${process.env.LMSTUDIO_HOST ?? "http://127.0.0.1:1234"}`
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
