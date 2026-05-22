# Security Probe Report

Generated: 2026-05-21T21:52:29.095Z
Target: http://localhost:3000

## Summary

- Total findings: 6
- Status: {"pass":4,"fail":0,"warn":1,"skip":0,"error":1}
- Severity: {"critical":0,"high":0,"medium":2,"low":0,"info":4}

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

### ws-malformed-payload-check-note - Malformed WebSocket payload path requires authenticated fuzz run
- Surface: websocket
- Status: warn
- Severity: medium
- Details: Run with valid credentials and send malformed/oversized payloads to verify close behavior and server stability.
- Reproduction:
  - Authenticate user and run scripted malformed frame tests against collaboration endpoint

### input-reflected-xss-check - Reflected input payload check
- Surface: input-sanitization
- Status: pass
- Severity: info
- Details: No raw reflected payload detected in API response.
- Reproduction:
  - curl -G "http://localhost:3000/api/search" --data-urlencode "query=<script>alert("ship_probe")</script>"

### dep-audit-failed - Dependency audit failed
- Surface: dependencies
- Status: error
- Severity: medium
- Details: Command failed: pnpm audit --json

- Reproduction:
  - pnpm audit --json
