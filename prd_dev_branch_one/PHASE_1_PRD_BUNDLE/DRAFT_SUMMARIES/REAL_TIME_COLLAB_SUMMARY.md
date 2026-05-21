# 4. Real-time Collaboration

### 4.0 Area overview

- Status: [X] Complete
- Prompt: Real-time collaboration deep-dive summary for sections 4.1-4.4.
- Findings:
  - Ship implements collaboration with Yjs CRDT documents over WebSockets, with TipTap on the client and a custom `ws` server on the API side.
  - Collaboration traffic is split into two channels: `/collaboration/*` for document CRDT sync and `/events` for user-scoped realtime notifications.
  - The system is offline-tolerant: IndexedDB cache loads first, then network sync converges state.
- Evidence (module entrypoints and architecture references):
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\Editor.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\modules\collaboration.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\modules\editor.md`
- Open Questions:
  - Should collaboration internals be split into smaller modules (auth/rate-limit/persistence/protocol) to reduce complexity in one large server file?
- Next Actions:
  - Add architectural sequence diagrams for connect/sync/persist/disconnect to onboarding docs.

### 4.1 WebSocket establishment flow

- Status: [X] Complete
- Prompt: How does the WebSocket connection get established?
- Findings:
  - API boot sequence calls `setupCollaboration(server)` from `api/src/index.ts`, attaching WebSocket upgrade handlers to the shared HTTP server.
  - On upgrade:
    - `/events` upgrades into an events WebSocket after per-IP rate-limit and session validation.
    - `/collaboration/*` upgrades only after per-IP rate-limit, session validation, and document-level visibility access check.
  - Invalid session and authorization failures are rejected before upgrade (`401` / `403` / `429` paths).
  - Client constructs WebSocket URLs from `VITE_API_URL` (or current host), uses room names like `${roomPrefix}:${documentId}`, and then performs Yjs sync handshake.
- Evidence (client connect code, server handler):
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\Editor.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\solutions\websocket-cloudfront-configuration.md`
- Open Questions:
  - Should JWT/Bearer token auth for websocket upgrades be supported for non-cookie API clients?
- Next Actions:
  - Add automated integration coverage for upgrade rejection paths (401/403/429) with clear assertions.

### 4.2 Yjs synchronization flow

- Status: [X] Complete
- Prompt: How does Yjs sync document state between users?
- Findings:
  - Client creates one `Y.Doc` per `documentId`, then layers `IndexeddbPersistence` and `WebsocketProvider` on top.
  - Initial sync order:
    1) Local IndexedDB loads cached CRDT data.
    2) WebSocket connects and exchanges Yjs sync protocol messages (`messageSync`).
    3) Awareness state (`messageAwareness`) syncs cursor/presence metadata.
  - Server relays update deltas to all peers in the same room (excluding the sender) and keeps awareness state in-room.
  - Custom message type `3` instructs clients to clear stale IndexedDB cache when server had to rebuild CRDT state from JSON.
- Evidence (Yjs provider/config, update handlers):
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\Editor.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\utils\yjsConverter.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\modules\collaboration.md`
- Open Questions:
  - Should sync telemetry (sync latency, reconnect count, cache-clear frequency) be emitted for operations visibility?
- Next Actions:
  - Add explicit metrics/log counters for cache-clear events and reconnect loops.

### 4.3 Concurrent editing behavior

- Status: [X] Complete
- Prompt: What happens when two users edit the same document at the same time?
- Findings:
  - Concurrent edits are merged by Yjs CRDT semantics (conflict-free by design), with each client converging to the same final state.
  - Presence and cursor states are shared through awareness updates; disconnect cleanup removes stale awareness clients.
  - App-level conflict handling adds guardrails beyond raw CRDT merge:
    - Access revocation closes sockets with `4403`.
    - Document conversion closes sockets with `4100` + new document metadata so clients can redirect.
    - API-side updates can force cache invalidation and reconnect (`4101` flow in editor).
  - For list/metadata operations outside the editor, server-authoritative APIs and route-level validation still govern conflicts.
- Evidence (CRDT merge behavior, app-level conflict rules):
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\Editor.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\__tests__\collaboration.test.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\__tests__\api-content-preservation.test.ts`
- Open Questions:
  - Are there edge cases where simultaneous REST mutations and CRDT edits can still create user-visible jitter?
- Next Actions:
  - Add stress tests mixing websocket edits and REST writes on the same document in tight windows.

### 4.4 Yjs persistence strategy

- Status: [X] Complete
- Prompt: How does the server persist Yjs state?
- Findings:
  - On each Yjs update, the server schedules a debounced save (2 seconds) per room/document.
  - Persist path:
    - Serialize CRDT state via `Y.encodeStateAsUpdate(doc)` into `documents.yjs_state`.
    - Convert current CRDT XML fragment to TipTap JSON backup into `documents.content`.
    - Extract structured fields (plan/success criteria/vision/goals) and merge into `documents.properties`.
  - Load path prefers binary `yjs_state`; if absent, it converts `content` JSON back into Yjs once and then persists fresh binary state.
  - On room drain (last socket closes), pending saves are flushed and in-memory room state is eventually evicted.
- Evidence (storage adapter, DB/file layer):
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\utils\yjsConverter.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\db\schema.sql`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\modules\collaboration.md`
- Open Questions:
  - Should persistence include optimistic retries/dead-letter handling when DB writes fail repeatedly?
- Next Actions:
  - Add explicit persistence-failure metrics and alert thresholds.
