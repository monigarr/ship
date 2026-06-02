import crypto from 'crypto';

export function verifyWebhook(
  headers: Record<string, string>,
  rawBody: string,
  secret: string,
  toleranceSec = 300
): boolean {
  const signature =
    headers['ship-signature'] ??
    headers['Ship-Signature'] ??
    headers['SHIP-SIGNATURE'];
  if (!signature) return false;

  const parts = signature.split(',').map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;

  const timestamp = Number.parseInt(tPart.slice(2), 10);
  const provided = v1Part.slice(3);
  if (!Number.isFinite(timestamp) || !provided) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}
