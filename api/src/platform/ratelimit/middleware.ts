import { NextFunction, Request, Response } from 'express';
import { sendPublicError } from '../http.js';

interface BucketState {
  tokens: number;
  resetAtMs: number;
}

const buckets = new Map<string, BucketState>();
const LIMIT = 120;
const WINDOW_MS = 60_000;

function bucketKey(req: Request): string {
  if (req.oauth?.clientId) {
    return `app:${req.oauth.clientId}`;
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

export function publicRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = bucketKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAtMs <= now) {
    bucket = { tokens: LIMIT, resetAtMs: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  if (bucket.tokens <= 0) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.setHeader('X-RateLimit-Limit', String(LIMIT));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.resetAtMs / 1000)));
    sendPublicError(req, res, 429, 'rate_limited', 'Rate limit exceeded');
    return;
  }

  bucket.tokens -= 1;
  res.setHeader('X-RateLimit-Limit', String(LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(bucket.tokens));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.resetAtMs / 1000)));
  next();
}

export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
