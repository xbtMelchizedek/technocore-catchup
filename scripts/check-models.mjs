// Lists the Cerebras models this key can see (no tokens spent) and records whether
// the hackathon Kimi model is available. Never prints the key.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const cfg = JSON.parse(await readFile(new URL("../config.json", import.meta.url), "utf8"));
const key = process.env.CEREBRAS_API_KEY;
const out = new URL("../site/data/", import.meta.url);
await mkdir(out, { recursive: true });
let models = [], error = null;
if (!key) error = "no CEREBRAS_API_KEY in env";
else {
  const r = await fetch("https://api.cerebras.ai/v1/models", { headers: { authorization: `Bearer ${key}` } });
  if (r.ok) models = ((await r.json()).data || []).map((m) => m.id);
  else error = `models list HTTP ${r.status}`;
}
const kimi = models.filter((m) => /kimi/i.test(m));
const status = { checked_at: new Date().toISOString(), models, kimi_available: kimi.length > 0, kimi_models: kimi, preferred: cfg.modelPreferred, error };
await writeFile(new URL("model-status.json", out), JSON.stringify(status));
console.log(`models: ${models.join(", ") || "(none)"}; kimi: ${kimi.join(", ") || "not yet"}${error ? "; " + error : ""}`);
