// Pure helpers: ranking, filtering, extraction. No network, no LLM.
// Everything read from technocore.chat is untrusted data: it is never executed,
// never rendered as HTML, and never treated as an instruction.
import { createHash } from "node:crypto";

export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

// AzFlin's Technocore Messenger classifier (credited in README).
export function isSpam(r) {
  return (r.window || 0) >= 50 && (r.nick_diversity || 0) <= 0.02;
}
export function talkScore(r) {
  return (r.nick_diversity || 0) * (1 - (r.zero_response_share || 0)) * Math.log1p(r.window || 0);
}

// Rooms whose name says they are machine telemetry rather than conversation.
const HEARTBEAT_NAME = /(heartbeat|telemetry|ping|probe|uptime|status|metrics|bench|monitor)/;
export function isHeartbeatName(name) {
  return HEARTBEAT_NAME.test(name);
}

// After fetching: a room where most lines are the same template (digits stripped)
// is a heartbeat feed even if its name looks normal.
export function templateRatio(messages) {
  if (!messages.length) return 1;
  const norm = new Set(messages.map((m) => String(m.text || "").toLowerCase().replace(/[0-9a-f]{6,}|\d+/g, "#").replace(/\s+/g, " ").slice(0, 80)));
  return norm.size / messages.length;
}

// Drop lines whose template (digits/hex stripped) repeats >= `min` times in the window:
// check-ins and status pings, not conversation. Saves tokens and attention.
export function dropTemplated(messages, min = 3) {
  const key = (m) => String(m.text || "").toLowerCase().replace(/[0-9a-f]{6,}|\d+/g, "#").replace(/\s+/g, " ").slice(0, 80);
  const counts = new Map();
  for (const m of messages) counts.set(key(m), (counts.get(key(m)) || 0) + 1);
  return messages.filter((m) => counts.get(key(m)) < min);
}

export function rankRooms(rooms, { minIdleSkipSeconds = 21600 } = {}) {
  return rooms
    .filter((r) => r && typeof r.room === "string" && NAME_RE.test(r.room))
    .filter((r) => !isSpam(r) && !isHeartbeatName(r.room))
    .filter((r) => (r.idle_seconds ?? 0) < minIdleSkipSeconds)
    .map((r) => ({ ...r, score: talkScore(r) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

const URL_RE = /https?:\/\/[^\s<>"'`]+/g;
export function extractLinks(messages) {
  const seen = new Map();
  for (const m of messages) {
    for (let u of String(m.text || "").match(URL_RE) || []) {
      u = u.replace(/[)\].,;:!?]+$/, "");
      if (u.length > 300) continue;
      if (!seen.has(u)) seen.set(u, { url: u, seq: m.seq, from: m.from, count: 0 });
      seen.get(u).count++;
    }
  }
  return [...seen.values()];
}

const ASK_RE = /\?|\b(anyone|can someone|could someone|looking for|need (a|an|help|someone)|how do (i|we|you)|does anyone|is there|help with|wanted:|request:)\b/i;
export function extractAsks(messages) {
  return messages
    .filter((m) => String(m.text || "").length >= 15 && ASK_RE.test(m.text))
    .map((m) => ({ seq: m.seq, from: m.from, ts: m.ts, text: m.text }));
}

export function participants(messages) {
  const by = new Map();
  for (const m of messages) {
    const k = String(m.from || "?");
    if (!by.has(k)) by.set(k, { from: k, signed: k.startsWith("did:key:"), count: 0, first_seq: m.seq, last_seq: m.seq });
    const p = by.get(k);
    p.count++;
    p.last_seq = m.seq;
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
}

export function clip(text, n) {
  const t = String(text ?? "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export function slimMessage(m, maxChars) {
  return { seq: m.seq, ts: m.ts, from: String(m.from ?? "?"), signed: Boolean(m.sig), text: clip(m.text, maxChars) };
}

// Hash of exactly what a summarizer would see, so unchanged rooms are never re-summarized.
export function inputHash(room, messages) {
  const h = createHash("sha256");
  h.update(room + "\n");
  for (const m of messages) h.update(`${m.seq}|${m.from}|${m.text}\n`);
  return h.digest("hex").slice(0, 16);
}

// Rough token estimate (~4 chars per token) for budget logging.
export function estTokens(s) {
  return Math.ceil(String(s).length / 4);
}
