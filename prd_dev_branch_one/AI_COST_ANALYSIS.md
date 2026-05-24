# AI Cost Analysis

## Scope

This analysis covers AI-assisted workflow for:

- Phase 1 audit synthesis
- Phase 2 compliance/evidence regeneration
- Cat8 security probe hardening and closeout packaging

## Direct Dev Spend (tracked in this branch artifacts)

- **Tooling/log artifacts created:** extensive command and evidence bundles under `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence` and `prd_dev_branch_one/PRD_CAT8/`
- **Approximate AI usage pattern:** high-frequency codebase navigation + medium-complexity refactoring + repeated evidence generation
- **Primary cost driver:** iterative validation loops (type-check/build/test/coverage/probe/benchmark reruns)

## AI Spend April 29th - May 29th 2026 (tracked on Cursor.com Billing)

- **21% of total usage** 
- **Cursor On-Demand Usage:** $0.00
- **April 29th - May 29th:** $213.20
- **21% of total usage:** 
Included Usage Billing Period: Apr 29, 2026 - May 29, 2026

Item        Tokens      Usage   %API
            591.2M      43.6%↳  premium  
            529.6M      31.8%↳  agent_review
            28.8M       10.5%↳  kimi-k
            2.529.8M    0.8%↳   gemini-3.1-pro
            1.5M        0.3%↳   claude-4.5-sonnet
            1.4M        0.2%↳   gemini-3-flash
            35.1K       0.0%    Auto + Composer
            258.3M      10.0%↳  auto
            247.2M      9.2%↳   composer-2-fast
            9.6M        0.7%↳   composer-2.5-fast1.5M0.1%

- **OpenAI usage** 
- **May 17th - 24th 2026**
Total Tokens: 0
May Spend: $0.03


## Effectiveness Assessment

### What AI accelerated

- Rapid requirement-to-evidence traceability creation (`STRICT_REQUIREMENT_CHECKLIST.md`)
- Fast hardening of security probe logic and reproducible report generation
- Faster packaging of closeout artifacts and consistency checks across PRD requirements
- Trial aikido.dev security scans identified the following Security Issues: 
-- **High Risk**
--- fast-uri 
--- zod
--- Docker container runs as default root user  -- hono
--- uuid
--- Path traversal attack possible via Express.js sendFile()
--- Potential SQL injection via string-based query concatenation
-- **Medium Risk**
--- Potential file inclusion attack via reading file
--- yaml 
-- **Low Risk**
--- 3 exposed secrets
--- fast-xml-parser
--- HTTP request might enable SSRF attack

### Where AI did not replace engineering effort

- Benchmark reliability remained environment-sensitive and required manual interpretation
- Performance target closure still depended on system-level behavior, not prompt quality
- Final acceptance still required strict artifact review and reproducibility checks
- Manual read / review of code repo documentation
- Manual visual / end user usage on the web deployment
- Manual review / decisions regarding architecture, updates, security tweaks

## ROI Summary

- **Strong ROI:** compliance tracing, documentation consolidation, and repeatable test/probe orchestration
- **Moderate ROI:** vulnerability triage and security workflow codification
- **Lower ROI areas:** hard performance optimization and infrastructure-sensitive latency targets

## Recommendation

Use AI as an accelerator for structured compliance workflows and evidence packaging, while keeping explicit human review gates for performance claims, security risk acceptance, and final sign-off.
