# AI Cost Analysis — Week 03 PlugForge

**Date:** 2026-06-02 · **Author:** Monica Peters

## Development spend (tracked)
May 31st to June 6th 2026
| Item | Estimate | Notes |
| --- | --- | --- |
| Cursor Usage | Tokens: 356.5 Million Cost: $190.40 | grok-build-0.1, default, premium, Bugbot, gpt-5.5-medium, composer-2.5-fast, grok-4.3, composer-2.5 |
| Codex Usage | Tokens: Cost: | Extension (VSCode), Desktop |
| Leaderboard Experiment | Tokens: 59.4M	Cost: $49.78 | MoniGarr Usage https://tokenburn.nayanbhut.dev/?period=weekly |
| OpenAI | --- | --- |
| ChatGPT | --- | --- |
| DeepSeek | --- | --- |
| OpenRouter | --- | --- |
| LocalAI | Memory Usage $22.90 | Railway Hosted: https://localai-production-0a66.up.railway.app/ |
| Epic 7 agent rewire validation | $0 incremental | Platform layer remains LLM-free; agent probe uses public API only |
| CI — MVP gates | ~8 min/PR | Unit + OpenAPI + measured perf probe + PKCE grep |
| CI — platform gates | ~12 min/PR | Added OAuth/webhook tests + CLI type-check |
| TTFE drill (CI) | ~2 min/PR | `platform-gates.yml` runs `scripts/platform/run-ttfe-ci.mjs` |
| OAuth Playwright | ~3 min/PR | PKCE spec in mvp-gates |

## Production projections

| Tier | API calls/day | Webhook deliveries/day | Agent LLM calls/day | Est. cost/month |
| --- | --- | --- | --- | --- |
| 100 users | ~20,000 | ~5,000 | ~50 | $2–8 |
| 1,000 users | ~200,000 | ~50,000 | ~500 | $15–50 |
| 10,000 users | ~2,000,000 | ~500,000 | ~5,000 | $80–250 |

Platform cost scales with API + webhook traffic, not LLM volume.

## Assumptions

- **Webhook fanout:** 1.2 deliveries per document write (avg 1–2 active subscriptions per event type in demo).
- **Agent active rate:** 5% of users, 2 agent turns/day when active — LLM cost unchanged by public API rewire.
- **Retention:** Webhook delivery log 30 days; platform audit log 90 days (~500 bytes/row).
