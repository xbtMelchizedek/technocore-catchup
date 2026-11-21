# Hackathon plan: Cerebras x Kimi K3.1 Pro (Sat Nov 21 10:00 AM PT to Sun Nov 22 10:00 AM PT)

The rules FAQ allows pre-existing scaffolding, but says "the core project and its functionality should be developed during the hackathon and must leverage Kimi K3.1 Pro running on Cerebras as a central component", and that "you need to use OpenClaw harness within your project".

## Built before kickoff (scaffolding)
- Data pipeline: `scripts/fetch.mjs` and `scripts/lib.mjs`. These do the public GETs, talk-score ranking, template/heartbeat filtering, links, heuristic asks, participants, the agent index and input hashes.
- Static site (`site/`): room cards, room page, agent page, live "new since digest" check, a CSP, and textContent-only rendering. The summary renderer for the JSON shape below is in place but shows "not generated" until the core step exists.
- Ops: hourly Action, Pages deploy, summary cache, a models check that spends no tokens, the budget guard (`scripts/budget.mjs`) and tests.
- Docs: README (credits AzFlin), `site/skill.md`, the demo script, and the submission draft (kept outside the repo).

## Core, built during the hackathon (after 10:00 AM PT / 1:00 PM ET / 12:00 PM CST)
1. Confirm `moonshotai-kimi-k3.1-pro-trial` shows up in `GET /v1/models` for our key (scripts/check-models.mjs). Set `config.json` `model` to it.
2. In the Action, install OpenClaw (`npm i -g openclaw`, node 24) plus `@openclaw/cerebras-provider`. Smoke-test with:
   `openclaw infer model run --local --model cerebras/moonshotai-kimi-k3.1-pro-trial --prompt "Reply with exactly: pong" --json`
   using env-only auth (CEREBRAS_API_KEY secret).
3. `scripts/summarize.mjs`:
   - For each featured room (top 8), skip it if `input_hash` matches `site/data/cache/<room>.json`. Otherwise build the delimited prompt (see skill.md) and run it through OpenClaw with Kimi.
   - Parse the JSON, then drop any point whose cited seqs aren't in the input (an anti-invention check). Write `summary` into the room JSON and `headline` into rooms.json.
   - Budget: estimate tokens before each call, stop at `maxEstimatedTokensPerRun`, and exit 3 on any billing or quota error. Log `usage.json` (counts only).
   - Add a per-agent catch-up for the top agents if the budget allows.
4. Turn on: repo variable `SUMMARIZE=true`, and `CATCHUP_MODEL=moonshotai-kimi-k3.1-pro-trial`.
5. Speed panel: show Kimi-on-Cerebras tokens/sec and wall time per room on the page (from the OpenClaw JSON usage). This feeds the demo's "Cerebras speed" requirement.
6. Record the 60s demo (docs/DEMO_SCRIPT.md). palmer posts on X: tag @Cerebras @Kimi_Moonshot and #KimiOnCerebras, before Sun Nov 22 10:00 AM PT. Reddit r/cerebras is optional, with flair "Kimi K3.1 Pro Hackathon".

## Budget
Hackathon Kimi access is free, through Mon Nov 23 10:00 AM PT, at 100 RPM / 100K TPM. Never buy credits, upgrade, or turn on auto-recharge. With 8 rooms × ~4K input tokens, plus cache hits on unchanged rooms, a run costs ≤ ~40K tokens, hourly at most. Do not run summaries with gpt-oss-120b / qwen on the paid org balance.
