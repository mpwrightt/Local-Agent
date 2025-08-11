import { Annotation, StateGraph, Command, START, END } from "@langchain/langgraph"
import fs from "node:fs"
import { db } from "../db"

// Shared state for the research graph
export const ResearchState = Annotation.Root({
  prompt: Annotation<string>({ value: (_prev, next) => next }),
  deep: Annotation<boolean>({ value: (_prev, next) => next, default: () => false }),
  // artifacts
  targets: Annotation<Array<{ title: string; url: string }>>({ value: (_prev, next) => next, default: () => [] }),
  aggregatePath: Annotation<string | undefined>({ value: (_prev, next) => next }),
  synthesis: Annotation<string | undefined>({ value: (_prev, next) => next }),
  snippets: Annotation<Array<{ title: string; url: string; snippet: string }>>({ value: (_prev, next) => next, default: () => [] }),
  selected: Annotation<Array<{ title: string; url: string; snippet: string }>>({ value: (_prev, next) => next, default: () => [] }),
})

type S = typeof ResearchState.State

// Nodes
export async function prepareNode(_state: S) {
  // Entry node (after scheduler research worker has finished). Nothing to do here.
  return {}
}

function parseAggregate(aggregatePath?: string): Array<{ title: string; url: string; snippet: string }> {
  try {
    if (!aggregatePath || !fs.existsSync(aggregatePath)) return []
    const raw = fs.readFileSync(aggregatePath, "utf8")
    const blocks = raw.split(/\n---\n\n?/)
    const out: Array<{ title: string; url: string; snippet: string }> = []
    for (const b of blocks) {
      const mTitle = b.match(/^#\s+(.+)$/m)
      const mUrl = b.match(/^https?:\/\/\S+/m)
      const quote = b.split(/\n\n/).slice(2).join("\n").trim() || b.trim()
      if (mTitle && mUrl) {
        const title = mTitle[1].trim()
        const url = mUrl[0].trim()
        const snippet = quote.replace(/^>\s?/gm, "").trim()
        if (snippet) out.push({ title, url, snippet })
      }
    }
    return out
  } catch {
    return []
  }
}

export async function extractNode(state: S) {
  db.addRunEvent((state as any).runId ?? "", { type: 'graph_extract_start', message: 'Extracting snippets from aggregate' })
  const snippets = parseAggregate(state.aggregatePath)
  db.addRunEvent((state as any).runId ?? "", { type: 'graph_extract_done', count: snippets.length })
  return { snippets }
}

export async function synthesizeNode(state: S) {
  db.addRunEvent((state as any).runId ?? "", { type: 'graph_synthesize_start', message: 'Synthesizing final report' })
  const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'

  async function getFetch(): Promise<(input: string, init?: any) => Promise<Response>> {
    const g: any = (globalThis as any)
    if (typeof g.fetch === 'function') return g.fetch.bind(globalThis)
    const mod = await import('node-fetch') as any
    return mod.default as (input: string, init?: any) => Promise<Response>
  }
  
  // Get model name
  let model = process.env.LMSTUDIO_MODEL ?? 'local-model'
  try {
    const doFetch = await getFetch()
    const resp = await doFetch(baseURL.replace(/\/$/, '') + '/models')
    if (resp.ok) {
      const data: any = await resp.json()
      model = data?.data?.[0]?.id ?? model
    }
  } catch { /* keep default */ }

  // Load corpus text if available
  let corpus = ""
  if (state.aggregatePath && fs.existsSync(state.aggregatePath)) {
    try {
      corpus = fs.readFileSync(state.aggregatePath, "utf8")
      // Cap to ~16k chars to keep request reasonable
      if (corpus.length > 16000) corpus = corpus.slice(0, 16000)
    } catch {}
  }

  const sourcesList = state.targets.map((t, i) => `[${i + 1}] ${t.title} - ${t.url}`).join("\n")
  const snippetList = (state.selected.length > 0 ? state.selected : state.snippets)
    .slice(0, 8)
    .map((s, i) => `S${i + 1}: ${s.title} (${s.url})\n${s.snippet}`)
    .join("\n\n")

  const prompt = `You are an expert technical analyst. Synthesize multiple sources into actionable insights.
Requirements:
- Produce 5-7 concise bullet takeaways that synthesize (do not list headlines)
- Use inline citations [1], [2] referencing the numbered Sources below
- Add a short implications paragraph for practitioners

Question: ${state.prompt}
Sources:\n${sourcesList || "[none]"}
Key snippets (truncated):\n${snippetList || "[no snippets]"}
Corpus (truncated):\n${corpus || "[no corpus available]"}`

  const messages = [
    { role: "system" as const, content: "Act as a meticulous analyst that cites sources and avoids hallucinations. Produce 5-7 concise bullets with inline [n] citations, then a 2-3 sentence implications paragraph for practitioners. If sources are weak or conflicting, note limitations explicitly." },
    { role: "user" as const, content: prompt },
  ]

  const doFetch = await getFetch()
  let text = 'No synthesis generated'
  try {
    const resp = await doFetch(baseURL.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer not-needed' },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 700 })
    })
    if (resp.ok) {
      const data: any = await resp.json()
      text = data?.choices?.[0]?.message?.content ?? text
    }
  } catch { /* keep fallback text */ }
  db.addRunEvent((state as any).runId ?? "", { type: 'graph_synthesize_done' })
  return { synthesis: text }
}

export async function finalizeNode(state: S) {
  void state
  return new Command({ goto: END })
}

export function buildResearchGraph() {
  const g = new StateGraph(ResearchState)
    .addNode("prepare", prepareNode)
    .addNode("extract", extractNode)
    .addNode("synthesize", synthesizeNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "prepare")
    .addEdge("prepare", "extract")
    .addEdge("extract", "synthesize")
    .addEdge("synthesize", "finalize")
    .compile()
  return g
}


