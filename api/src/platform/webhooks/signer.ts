import crypto from 'crypto';

export function computeWebhookSignature(secret: string, timestamp: number, rawBody: string): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
}

export function buildSignatureHeader(secret: string, rawBody: string, timestampSec?: number): string {
  const t = timestampSec ?? Math.floor(Date.now() / 1000);
  const v1 = computeWebhookSignature(secret, t, rawBody);
  return `t=${t},v1=${v1}`;
}

export function verifyWebhookSignature(
  header: string,
  rawBody: string,
  secret: string,
  toleranceSec = 300
): boolean {
  const parts = header.split(',').map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;

  const timestamp = Number.parseInt(tPart.slice(2), 10);
  const provided = v1Part.slice(3);
  if (!Number.isFinite(timestamp) || !provided) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) return false;

  const expected = computeWebhookSignature(secret, timestamp, rawBody);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}
