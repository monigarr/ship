# Security Probe Report

Generated: 2026-05-21T22:07:13.588Z
Target: http://localhost:3000

## Summary

- Total findings: 37
- Status: {"pass":4,"fail":0,"warn":33,"skip":0,"error":0}
- Severity: {"critical":2,"high":30,"medium":1,"low":0,"info":4}

## Findings

### auth-unauthenticated-route-access - Unauthenticated auth route rejection
- Surface: auth-session
- Status: pass
- Severity: info
- Details: Route correctly rejects unauthenticated access.
- Reproduction:
  - curl -i "http://localhost:3000/api/auth/me"

### auth-member-admin-escalation-check - Member cannot access admin endpoint
- Surface: auth-session
- Status: pass
- Severity: info
- Details: Access correctly blocked with 401.
- Reproduction:
  - Login as non-admin member
  - curl -i -H "cookie: session_id=..." "http://localhost:3000/api/admin/workspaces"

### ws-unauthenticated-upgrade-check - Unauthenticated WebSocket upgrade rejection
- Surface: websocket
- Status: pass
- Severity: info
- Details: WebSocket endpoint rejects unauthenticated connections.
- Reproduction:
  - wscat -c "ws://localhost:3000/collaboration/security-probe:00000000-0000-0000-0000-000000000000"

### ws-malformed-payload-check-auth-failed - Authenticated WebSocket malformed payload check unavailable
- Surface: websocket
- Status: warn
- Severity: medium
- Details: Could not authenticate member user (login status 403).
- Reproduction:
  - Verify SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD values.

### input-reflected-xss-check - Reflected input payload check
- Surface: input-sanitization
- Status: pass
- Severity: info
- Details: No raw reflected payload detected in API response.
- Reproduction:
  - curl -G "http://localhost:3000/api/search" --data-urlencode "query=<script>alert("ship_probe")</script>"

### dep-advisory-1113461 - Dependency advisory: minimatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113465 - Dependency advisory: minimatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113515 - Dependency advisory: rollup
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Rollup 4 has Arbitrary File Write via Path Traversal (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113540 - Dependency advisory: minimatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113544 - Dependency advisory: minimatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113548 - Dependency advisory: minimatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113552 - Dependency advisory: minimatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113568 - Dependency advisory: fast-xml-parser
- Surface: dependencies
- Status: warn
- Severity: critical
- Details: fast-xml-parser has an entity encoding bypass via regex injection in DOCTYPE entity names (critical)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1113569 - Dependency advisory: fast-xml-parser
- Surface: dependencies
- Status: warn
- Severity: high
- Details: fast-xml-parser affected by DoS through entity expansion in DOCTYPE (no expansion limit) (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114006 - Dependency advisory: hono
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Hono vulnerable to arbitrary file access via serveStatic vulnerability  (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114151 - Dependency advisory: svgo
- Surface: dependencies
- Status: warn
- Severity: high
- Details: SVGO DoS through entity expansion in DOCTYPE (Billion Laughs) (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114170 - Dependency advisory: @hono/node-server
- Surface: dependencies
- Status: warn
- Severity: high
- Details: @hono/node-server has authorization bypass for protected static paths via encoded slashes in Serve Static Middleware (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114194 - Dependency advisory: express-rate-limit
- Surface: dependencies
- Status: warn
- Severity: high
- Details: express-rate-limit: IPv4-mapped IPv6 addresses bypass per-client rate limiting on servers with dual-stack network (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114526 - Dependency advisory: flatted
- Surface: dependencies
- Status: warn
- Severity: high
- Details: flatted vulnerable to unbounded recursion DoS in parse() revive phase (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114591 - Dependency advisory: undici
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Undici: Malicious WebSocket 64-bit length overflows parser and crashes the client (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114637 - Dependency advisory: undici
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Undici has Unbounded Memory Consumption in WebSocket permessage-deflate Decompression (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1114639 - Dependency advisory: undici
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Undici has Unhandled Exception in WebSocket Client Due to Invalid server_max_window_bits Validation (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1115339 - Dependency advisory: fast-xml-parser
- Surface: dependencies
- Status: warn
- Severity: high
- Details: fast-xml-parser affected by numeric entity expansion bypassing all entity expansion limits (incomplete fix for CVE-2026-26278) (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1115357 - Dependency advisory: flatted
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Prototype Pollution via parse() in NodeJS flatted (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1115527 - Dependency advisory: path-to-regexp
- Surface: dependencies
- Status: warn
- Severity: high
- Details: path-to-regexp vulnerable to Regular Expression Denial of Service via multiple route parameters (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1115552 - Dependency advisory: picomatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Picomatch has a ReDoS vulnerability via extglob quantifiers (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1115554 - Dependency advisory: picomatch
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Picomatch has a ReDoS vulnerability via extglob quantifiers (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1115573 - Dependency advisory: path-to-regexp
- Surface: dependencies
- Status: warn
- Severity: high
- Details: path-to-regexp vulnerable to Denial of Service via sequential optional groups (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1115806 - Dependency advisory: lodash
- Surface: dependencies
- Status: warn
- Severity: high
- Details: lodash vulnerable to Code Injection via `_.template` imports key names (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1116234 - Dependency advisory: vite
- Surface: dependencies
- Status: warn
- Severity: high
- Details: Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1117571 - Dependency advisory: protobufjs
- Surface: dependencies
- Status: warn
- Severity: critical
- Details: Arbitrary code execution in protobufjs (critical)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1117870 - Dependency advisory: fast-uri
- Surface: dependencies
- Status: warn
- Severity: high
- Details: fast-uri vulnerable to path traversal via percent-encoded dot segments (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1117884 - Dependency advisory: fast-uri
- Surface: dependencies
- Status: warn
- Severity: high
- Details: fast-uri vulnerable to host confusion via percent-encoded authority delimiters (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1118641 - Dependency advisory: protobufjs
- Surface: dependencies
- Status: warn
- Severity: high
- Details: protobuf.js: Code injection through bytes field defaults in generated toObject code (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1118928 - Dependency advisory: protobufjs
- Surface: dependencies
- Status: warn
- Severity: high
- Details: protobuf.js: Code generation gadget after prototype pollution (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1118930 - Dependency advisory: protobufjs
- Surface: dependencies
- Status: warn
- Severity: high
- Details: protobuf.js: Process-wide denial of service through unsafe option paths (high)
- Reproduction:
  - pnpm audit --json

### dep-advisory-1118932 - Dependency advisory: protobufjs
- Surface: dependencies
- Status: warn
- Severity: high
- Details: protobuf.js: Denial of service through unbounded protobuf recursion (high)
- Reproduction:
  - pnpm audit --json
