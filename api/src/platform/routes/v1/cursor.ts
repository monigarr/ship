export interface CursorPayload {
  id: string;
  created_at: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const parsed = JSON.parse(raw) as CursorPayload;
  if (!parsed?.id || !parsed?.created_at) {
    throw new Error('Invalid cursor payload');
  }
  return parsed;
}
