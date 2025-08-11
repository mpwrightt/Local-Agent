import { Annotation, StateGraph, Command, START, END } from "@langchain/langgraph"
import OpenAI from "openai"
import fs from "node:fs"

// Shared state for the research graph
export const ResearchState = Annotation.Root({
  prompt: Annotation<string>({ value: (_prev, next) => next }),
  deep: Annotation<boolean>({ value: (_prev, next) => next, default: () => false }),
  // artifacts
  targets: Annotation<Array<{ title: string; url: string }>>({ value: (_prev, next) => next, default: () => [] }),
  aggregatePath: Annotation<string | undefined>({ value: (_prev, next) => next }),
  synthesis: Annotation<string | undefined>({ value: (_prev, next) => next }),
})

type S = typeof ResearchState.State

// Nodes
export async function crawlNode(state: S) {
  // The scheduler already ran playwright scraping and placed artifacts via events/files.
  // Here we simply mark that crawl stage is complete.
  void state
  return {}
}

export async function synthesizeNode(state: S) {
  const baseURL = process.env.LMSTUDIO_HOST ?? 'http://127.0.0.1:1234/v1'
  const client = new OpenAI({
    baseURL,
    apiKey: 'not-needed'
  })
  
  // Get model name
  let model = process.env.LMSTUDIO_MODEL ?? 'local-model'
  try {
    const models = await client.models.list()
    model = models.data[0]?.id ?? 'local-model'
  } catch {
    // Use fallback
  }

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

  const prompt = `You are an expert technical analyst. Synthesize multiple sources into actionable insights.
Requirements:
- Produce 5-7 concise bullet takeaways that synthesize (do not list headlines)
- Use inline citations [1], [2] referencing the numbered Sources below
- Add a short implications paragraph for practitioners

Question: ${state.prompt}
Sources:\n${sourcesList || "[none]"}
Corpus (truncated):\n${corpus || "[no corpus available]"}`

  const messages = [
    { role: "system" as const, content: "Act as a meticulous analyst that cites sources and avoids hallucinations. Produce 5-7 concise bullets with inline [n] citations, then a 2-3 sentence implications paragraph for practitioners. If sources are weak or conflicting, note limitations explicitly." },
    { role: "user" as const, content: prompt },
  ]

  const res = await client.chat.completions.create({ 
    model, 
    messages, 
    temperature: 0.1, 
    max_tokens: 700 
  })
  const text = res.choices[0]?.message?.content ?? 'No synthesis generated'
  return { synthesis: text }
}

export async function finalizeNode(state: S) {
  void state
  return new Command({ goto: END })
}

export function buildResearchGraph() {
  const g = new StateGraph(ResearchState)
    .addNode("crawl", crawlNode)
    .addNode("synthesize", synthesizeNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "crawl")
    .addEdge("crawl", "synthesize")
    .addEdge("synthesize", "finalize")
    .compile()
  return g
}


