/**
 * Editorial heuristics that keep low-value feed noise out of the pipeline.
 *
 * Two layers:
 *  - `classifyJunk` — hard gate run before embedding/enrichment. Catches items
 *    that are clearly not news (shopping deals, giveaways, puzzle hints,
 *    horoscopes…) so we never spend tokens, rows, or screen space on them.
 *  - `estimateNewsworthiness` — a 0–100 stand-in for the LLM's newsworthiness
 *    rating, used whenever an item is outside the enrichment budget or AI is
 *    off. Previously every fallback item scored a flat 50, which made the
 *    impact ranking meaningless without an API key.
 *
 * Patterns are deliberately conservative: "deal" alone is real news (trade
 * deal, acquisition deal) — only unambiguous shopping/promo phrasing is cut.
 */

const JUNK_PATTERNS: { reason: string; re: RegExp }[] = [
  {
    reason: "shopping/deals",
    re: /(\$\d+(?:\.\d+)? off\b|\b\d+% off\b|\bdrops? to \$\d|\bon sale for\b|\blowest price\b|\bwhere to (?:buy|pre-?order)\b|\bbest\b.{0,40}\bdeals\b|\bdeals? (?:of the (?:day|week)|alert|roundup)\b|\bdaily deals\b|\btop deals\b|\bcoupon\b|\bpromo code\b|\bblack friday\b|\bcyber monday\b|\bprime day\b|\bgift guide\b|\bbuying guide\b)/i,
  },
  {
    reason: "sponsored",
    re: /\b(sponsored|advertorial|partner content|paid post|brought to you by)\b/i,
  },
  { reason: "giveaway", re: /\b(giveaway|sweepstakes?|enter to win)\b/i },
  {
    reason: "puzzle hints",
    re: /\b(wordle|crossword|sudoku|strands|nyt connections)\b.{0,40}\b(hints?|answers?|clues?|today)\b|\b(hints?|answers?)\b.{0,40}\b(wordle|crossword|strands|connections)\b/i,
  },
  { reason: "horoscope", re: /\bhoroscopes?\b|\bzodiac\b/i },
  { reason: "media plug", re: /^\s*(listen|watch|podcast|in case you missed it|icymi)\s*[:|]/i },
];

/**
 * Return a short reason when the item is clearly not news, or null to keep it.
 * Only the title is pattern-matched — body text quotes too freely to be a
 * reliable junk signal.
 */
export function classifyJunk(title: string, rawContent: string): string | null {
  for (const { reason, re } of JUNK_PATTERNS) {
    if (re.test(title)) return reason;
  }
  // Bare stubs: a couple of words and no body is unrankable noise.
  if (title.trim().split(/\s+/).length < 3 && rawContent.trim().length < 80) return "empty stub";
  return null;
}

/** Hallmarks of consequential news: launches, rulings, deals, disasters, money. */
const HIGH_SIGNAL =
  /\b(breaking|exclusive|launch(?:es|ed)?|unveil(?:s|ed)?|announc(?:es|ed)|acqui(?:res?|red|sition)|merger|raises \$|funding round|ipo|lawsuit|sues?|sued|ruling|verdict|indict(?:s|ed|ment)?|breakthrough|record[- ](?:high|low|breaking)|first[- ]ever|dies(?: at)?|death toll|elect(?:ion|ed)|war|ceasefire|invasion|sanctions?|tariffs?|recall(?:s|ed)?|outage|data breach|hacked|layoffs?|resign(?:s|ed|ation)?|bankruptcy|shut(?:s|ting)? down|state of emergency|bans?|banned|approv(?:es|ed|al)|fda|supreme court|regulat(?:or|ion|ors))\b/gi;

/** Hallmarks of filler: listicles, explainers, rumors, recaps, reviews. */
const LOW_SIGNAL =
  /\b(how to|what to know|what we know|everything you need|explained|explainer|recap|roundup|rumor(?:s|ed)?|opinion|review:|hands[- ]on|top \d+|\d+ (?:best|things|ways|tips|reasons)|best \w+ of 20\d\d|preview|trailer|highlights|quiz|newsletter|here'?s why|where to (?:watch|stream))\b/gi;

function countMatches(re: RegExp, text: string): number {
  return text.match(re)?.length ?? 0;
}

/**
 * Heuristic 0–100 newsworthiness from the headline and body — the offline
 * counterpart of the LLM's `impact` rating. Neutral items land at 50; strong
 * news verbs push up, filler phrasing pushes down. Clamped to 15–85 so a
 * heuristic guess can never outrank or fully bury a model-rated story.
 */
export function estimateNewsworthiness(title: string, rawContent: string): number {
  let score = 50;

  score += Math.min(countMatches(HIGH_SIGNAL, title), 2) * 12; // up to +24
  score -= Math.min(countMatches(LOW_SIGNAL, title), 2) * 12; // up to -24

  // Body signals are weaker — headlines are where feeds put their intent.
  const lede = rawContent.slice(0, 600);
  score += Math.min(countMatches(HIGH_SIGNAL, lede), 2) * 3;

  if (/\?\s*$/.test(title.trim())) score -= 8; // Betteridge headlines
  if (rawContent.length > 1500) score += 5; // substantial body
  else if (rawContent.length < 200) score -= 5; // teaser-only item

  return Math.round(Math.max(15, Math.min(85, score)));
}
