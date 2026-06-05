# Final submission URLs (paste after recording / posting)

**Deploy status (2026-06-04):** Green — [`deploy-verify-2026-06-04.log`](./evidence/deploy-verify-2026-06-04.log) · production endpoint smoke [`prod-ttfe-smoke-2026-06-04.log`](./evidence/prod-ttfe-smoke-2026-06-04.log)

| Artifact | URL |
| --- | --- |
| Demo video (3–5 min, unlisted) | _paste YouTube/Loom URL after recording_ |
| Social post (@GauntletAI + webhook tail screenshot) | _paste X/Twitter post URL after posting_ |

## Recording checklist (production ready)

1. Confirm deploy: `node scripts/platform/verify-deploy.mjs` (all OK).
2. Follow [`DEMO_VIDEO_SCRIPT.md`](./DEMO_VIDEO_SCRIPT.md) — five-line story + portal replay.
3. Register a CLI OAuth app (super admin) with `documents:write` + `webhooks:manage`, or use an existing app:

```bash
export SHIP_API_URL=https://ship-web-jyqh.onrender.com
export SHIP_CLIENT_ID=<your_app_client_id>
pnpm --filter @ship/sdk build
pnpm --filter @ship/cli build
ship login
ship docs create --title "hello"
ship webhooks tail
```

4. Optional full-loop smoke with super-admin creds:

```bash
SHIP_PROD_EMAIL=... SHIP_PROD_PASSWORD=... node scripts/platform/run-prod-ttfe-smoke.mjs
```

5. Upload unlisted video; paste URL into this file and into [`FINAL_SUBMISSION.md`](./FINAL_SUBMISSION.md).

## Social post checklist

1. Use draft in [`SOCIAL_POST_DRAFT.md`](./SOCIAL_POST_DRAFT.md).
2. Screenshot: `ship webhooks tail` showing `verified ✓`.
3. Tag @GauntletAI; paste post URL into this file and FINAL_SUBMISSION.
