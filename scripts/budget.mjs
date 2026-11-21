// Budget guard for any LLM step. Free credits only: we never buy, upgrade or auto-recharge.
// - hard cap on estimated tokens per run (config.budget.maxEstimatedTokensPerRun)
// - any billing / quota / payment style error stops the whole run (exit 3), no retries
// - usage is logged to site/data/usage.json (counts only, never prompts or keys)
import { readFile, writeFile } from "node:fs/promises";

const BILLING_RE = /(billing|credit|quota|insufficient|payment|upgrade|exceed|plan limit|tokens? per day|daily limit)/i;

export function isBudgetStop(status, bodyText) {
  if (status === 402) return true;
  if (status === 429 && BILLING_RE.test(bodyText || "")) return true;
  if (status >= 400 && BILLING_RE.test(bodyText || "")) return true;
  return false;
}

export class Budget {
  constructor(maxTokens) {
    this.max = maxTokens;
    this.estIn = 0;
    this.estOut = 0;
    this.reportedIn = 0;
    this.reportedOut = 0;
    this.calls = 0;
    this.cacheHits = 0;
  }
  canSpend(estimate) {
    return this.estIn + this.estOut + estimate <= this.max;
  }
  record({ estIn = 0, estOut = 0, usage = null }) {
    this.calls++;
    this.estIn += estIn;
    this.estOut += estOut;
    if (usage) {
      this.reportedIn += usage.prompt_tokens || 0;
      this.reportedOut += usage.completion_tokens || 0;
    }
  }
  summary(model) {
    return { model, calls: this.calls, cache_hits: this.cacheHits, est_tokens: this.estIn + this.estOut, reported_prompt_tokens: this.reportedIn, reported_completion_tokens: this.reportedOut, cap: this.max };
  }
}

export async function appendUsage(path, entry) {
  let log = [];
  try { log = JSON.parse(await readFile(path, "utf8")); } catch {}
  log.push({ at: new Date().toISOString(), ...entry });
  await writeFile(path, JSON.stringify(log.slice(-200), null, 1));
}
