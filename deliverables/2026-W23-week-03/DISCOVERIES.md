# Three Discoveries — Week 03

## 1. Device Authorization Grant in hand-rolled TypeScript

RFC 8628 `slow_down` is easier to test when `last_poll_at` is stored per device code rather than inferred globally. Polling interval enforcement belongs in the token endpoint, not the client.

## 2. Zod event registry + in-memory bus before queue

Publishing `document.created` from a small `publishDocumentCreated()` helper kept routes thin and made the TTFE path testable without Redis. The deliverer’s injectable `Clock` avoids flaky `setTimeout` assertions in retry tests.

## 3. Stripe-style webhook signatures in one SDK call

Signing `timestamp + '.' + rawBody` with a single `verifyWebhook()` helper let the CLI `webhooks tail` demo and Vitest share the same verification logic as subscribers.
