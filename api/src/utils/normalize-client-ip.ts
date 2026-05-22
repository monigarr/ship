export function normalizeClientIp(ip: string | undefined): string {
  const candidate = (ip ?? '').trim();
  if (!candidate) {
    return 'unknown';
  }

  if (candidate.startsWith('::ffff:')) {
    return candidate.slice(7);
  }

  return candidate;
}
