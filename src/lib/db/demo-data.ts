/**
 * Demo articles so the dashboard is populated immediately after `npm run db:seed`,
 * without needing network access or an OpenAI key. Real ingestion adds live items
 * on top of these. Attributed to real seeded sources so the UI looks authentic.
 *
 * Two items (Llama 4 from Meta AI + The Verge) intentionally share `clusterKey`
 * to demonstrate cross-source deduplication & clustering in the UI.
 */
export type DemoItem = {
  sourceName: string;
  title: string;
  summary: string;
  author: string;
  url: string;
  imageUrl?: string;
  hoursAgo: number;
  tags: string[];
  entities: string[];
  topic: string;
  impactScore: number;
  clusterKey?: string; // items sharing a key are grouped as one story
};

export const DEMO_ITEMS: DemoItem[] = [
  {
    sourceName: "OpenAI",
    title: "OpenAI introduces GPT-5.2 with improved long-horizon reasoning",
    summary:
      "The new flagship model shows sizable gains on agentic benchmarks and adds a configurable reasoning-effort control, letting developers trade latency for depth on demand.",
    author: "OpenAI",
    url: "https://openai.com/index/gpt-5-2/",
    hoursAgo: 3,
    tags: ["LLM", "reasoning", "release"],
    entities: ["OpenAI", "GPT-5.2"],
    topic: "Model Releases",
    impactScore: 94,
  },
  {
    sourceName: "Anthropic",
    title: "Anthropic ships Claude with a 2M-token context window",
    summary:
      "Claude's context window quadruples to two million tokens, targeting whole-codebase analysis and long multi-document workflows while holding retrieval accuracy steady.",
    author: "Anthropic",
    url: "https://www.anthropic.com/news/claude-2m-context",
    hoursAgo: 6,
    tags: ["LLM", "context-window", "release"],
    entities: ["Anthropic", "Claude"],
    topic: "Model Releases",
    impactScore: 90,
  },
  {
    sourceName: "Meta AI",
    title: "Meta releases Llama 4 as open weights under a permissive license",
    summary:
      "Meta's Llama 4 family launches with open weights across three sizes, native multimodality, and a mixture-of-experts design aimed at cutting inference cost for self-hosters.",
    author: "Meta AI Research",
    url: "https://ai.meta.com/blog/llama-4/",
    hoursAgo: 10,
    tags: ["open-source", "LLM", "release"],
    entities: ["Meta", "Llama 4"],
    topic: "Open Source",
    impactScore: 92,
    clusterKey: "llama4",
  },
  {
    sourceName: "The Verge",
    title: "Meta's Llama 4 is here — and it's fully open weight",
    summary:
      "Meta has published the weights for Llama 4, its most capable open model yet, escalating the open-vs-closed race with OpenAI and Google.",
    author: "Alex Heath",
    url: "https://www.theverge.com/2026/meta-llama-4-open-weights",
    hoursAgo: 9,
    tags: ["open-source", "LLM"],
    entities: ["Meta", "Llama 4"],
    topic: "Open Source",
    impactScore: 78,
    clusterKey: "llama4",
  },
  {
    sourceName: "Google DeepMind",
    title: "DeepMind's AlphaProteo 2 designs binders for previously undruggable targets",
    summary:
      "A new generative model proposes protein binders for targets that resisted prior methods, with wet-lab validation reporting a marked jump in binding success rates.",
    author: "DeepMind",
    url: "https://deepmind.google/discover/blog/alphaproteo-2/",
    hoursAgo: 14,
    tags: ["science", "biology", "research"],
    entities: ["DeepMind", "AlphaProteo"],
    topic: "AI for Science",
    impactScore: 85,
  },
  {
    sourceName: "arXiv cs.CL",
    title: "Self-Distilled Retrieval Heads Cut Hallucination by 41%",
    summary:
      "The paper isolates attention heads responsible for factual recall and distills them into a lightweight verifier, reducing hallucinations on long-form QA without extra parameters.",
    author: "Chen et al.",
    url: "https://arxiv.org/abs/2607.01234",
    hoursAgo: 18,
    tags: ["research", "RAG", "hallucination"],
    entities: ["arXiv"],
    topic: "Research",
    impactScore: 71,
  },
  {
    sourceName: "Hugging Face",
    title: "Transformers v5 lands with first-class support for state-space models",
    summary:
      "The release unifies attention and SSM backbones under one API, ships faster kernels, and adds a streamlined path for training hybrid architectures.",
    author: "Hugging Face",
    url: "https://huggingface.co/blog/transformers-v5",
    hoursAgo: 22,
    tags: ["open-source", "tooling", "release"],
    entities: ["Hugging Face", "Transformers"],
    topic: "Tooling",
    impactScore: 74,
  },
  {
    sourceName: "TechCrunch AI",
    title: "AI coding startup raises $300M Series C at a $4B valuation",
    summary:
      "The agentic coding company says enterprise revenue tripled year over year as it expands autonomous refactoring and test-generation features.",
    author: "Kyle Wiggers",
    url: "https://techcrunch.com/2026/07/03/ai-coding-series-c/",
    hoursAgo: 26,
    tags: ["funding", "startups", "coding"],
    entities: ["Series C"],
    topic: "Business",
    impactScore: 66,
  },
  {
    sourceName: "Microsoft AI",
    title: "Microsoft brings on-device Phi-5 models to Copilot+ PCs",
    summary:
      "The compact Phi-5 family runs fully offline on NPUs, powering local summarization and rewrite features with no cloud round-trip.",
    author: "Microsoft",
    url: "https://blogs.microsoft.com/ai/phi-5-on-device/",
    hoursAgo: 30,
    tags: ["on-device", "SLM", "release"],
    entities: ["Microsoft", "Phi-5"],
    topic: "Edge AI",
    impactScore: 69,
  },
  {
    sourceName: "MIT Tech Review",
    title: "The quiet standardization of AI agent protocols",
    summary:
      "A deep dive into how competing agent-interoperability standards are converging, and what a shared tool-calling protocol would mean for the ecosystem.",
    author: "Melissa Heikkilä",
    url: "https://www.technologyreview.com/2026/07/02/agent-protocols/",
    hoursAgo: 34,
    tags: ["agents", "standards", "analysis"],
    entities: ["MCP"],
    topic: "Agents",
    impactScore: 63,
  },
  {
    sourceName: "VentureBeat AI",
    title: "Enterprises shift from RAG pilots to production knowledge agents",
    summary:
      "Survey data shows a majority of large enterprises moved at least one retrieval-augmented agent into production this year, with governance now the top concern.",
    author: "VentureBeat Staff",
    url: "https://venturebeat.com/ai/enterprise-knowledge-agents-2026/",
    hoursAgo: 40,
    tags: ["enterprise", "RAG", "agents"],
    entities: ["Enterprise"],
    topic: "Enterprise",
    impactScore: 58,
  },
  {
    sourceName: "Hacker News (AI)",
    title: "Show HN: A local-first vector database that runs in the browser",
    summary:
      "An open-source WASM vector store enabling semantic search entirely client-side, with pluggable embeddings and no server dependency.",
    author: "hn-user",
    url: "https://news.ycombinator.com/item?id=41000000",
    hoursAgo: 44,
    tags: ["open-source", "vector-db", "show-hn"],
    entities: ["WASM"],
    topic: "Tooling",
    impactScore: 52,
  },
];
