import { test } from "node:test";
import assert from "node:assert/strict";
import { isSpam, talkScore, rankRooms, templateRatio, dropTemplated, extractLinks, extractAsks, participants, inputHash, isHeartbeatName } from "../scripts/lib.mjs";
import { isBudgetStop, Budget } from "../scripts/budget.mjs";

test("talk-score and spam match AzFlin's classifier", () => {
  assert.equal(isSpam({ window: 50, nick_diversity: 0.02 }), true);
  assert.equal(isSpam({ window: 49, nick_diversity: 0.01 }), false);
  assert.ok(Math.abs(talkScore({ window: 200, nick_diversity: 0.5, zero_response_share: 0.2 }) - 0.5 * 0.8 * Math.log1p(200)) < 1e-9);
});
test("rankRooms drops spam, heartbeat names, idle and bad names", () => {
  const r = rankRooms([
    { room: "good", window: 100, nick_diversity: 0.5, zero_response_share: 0.1, idle_seconds: 10 },
    { room: "spam", window: 100, nick_diversity: 0.01, zero_response_share: 0, idle_seconds: 10 },
    { room: "node-heartbeat", window: 100, nick_diversity: 0.5, zero_response_share: 0, idle_seconds: 10 },
    { room: "old", window: 100, nick_diversity: 0.5, zero_response_share: 0, idle_seconds: 999999 },
    { room: "Bad Name<script>", window: 100, nick_diversity: 0.9, zero_response_share: 0, idle_seconds: 1 },
  ]);
  assert.deepEqual(r.map((x) => x.room), ["good"]);
  assert.ok(isHeartbeatName("a2a_mesh_telemetry"));
});
test("template detection catches check-in floods", () => {
  const flood = Array.from({ length: 30 }, (_, i) => ({ seq: i, text: `Agent batch-${1000 + i} tracking FLOP testnet.` }));
  assert.ok(templateRatio(flood) < 0.3);
  assert.equal(dropTemplated([...flood, { seq: 99, text: "real question: who runs the faucet?" }]).length, 1);
});
test("links, asks, participants, hash", () => {
  const msgs = [
    { seq: 1, from: "did:key:z6Mkabc", text: "see https://example.com/x). ok" },
    { seq: 2, from: "bob", text: "does anyone have a devnet RPC that works?" },
    { seq: 3, from: "bob", text: "thanks" },
  ];
  assert.deepEqual(extractLinks(msgs).map((l) => [l.url, l.seq]), [["https://example.com/x", 1]]);
  assert.deepEqual(extractAsks(msgs).map((a) => a.seq), [2]);
  assert.deepEqual(participants(msgs).map((p) => [p.from, p.count, p.signed]), [["bob", 2, false], ["did:key:z6Mkabc", 1, true]]);
  assert.equal(inputHash("r", msgs), inputHash("r", msgs.map((m) => ({ ...m }))));
  assert.notEqual(inputHash("r", msgs), inputHash("r", msgs.slice(1)));
});
test("budget guard stops on billing errors and caps tokens", () => {
  assert.equal(isBudgetStop(402, ""), true);
  assert.equal(isBudgetStop(429, "Tokens per day limit exceeded"), true);
  assert.equal(isBudgetStop(429, "slow down"), false);
  assert.equal(isBudgetStop(400, "insufficient credits"), true);
  const b = new Budget(1000);
  assert.ok(b.canSpend(900));
  b.record({ estIn: 800, estOut: 100 });
  assert.equal(b.canSpend(200), false);
});
