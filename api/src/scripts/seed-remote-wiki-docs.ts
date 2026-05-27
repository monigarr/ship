/**
 * @version 0.1.0
 * @date 2026-05-23
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Bulk-create wiki documents on a remote Ship instance from weekly deliverable markdown files.
 *
 * Usage:
 *   SHIP_BASE_URL=https://ship-web-jyqh.onrender.com \
 *   SHIP_EMAIL=you@example.com \
 *   SHIP_PASSWORD=secret \
 *   pnpm --filter @ship/api seed:remote-wiki
 *
 * Optional:
 *   SHIP_SEED_ROOT_TITLE="GFA Week 4 — PRD Portfolio"
 *   SHIP_SEED_SOURCE_DIR=../../../deliverables/2026-W21-week-01
 *   SHIP_SEED_DRY_RUN=1
 *   SHIP_SEED_DELAY_MS=300
 *   SHIP_SEED_RESUME=1          (skip root creation; only add missing pages)
 *
 * Example:
 *   cd ship && pnpm --filter @ship/api seed:remote-wiki
 *
 * Dependencies: Node 20+ fetch and markdown files under `deliverables/`
 *
 * Security/PHI: N/A — no PHI; credentials via env only, never committed
 * HIPAA: N/A — no PHI
 * FHIR: N/A — not interoperability
 * Accessibility: N/A — non-UI
 * Performance: Sequential creates with configurable delay
 * Stability: Skips re-run if root portfolio doc already exists (same title)
 * Legal/compliance: N/A
 */

import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_TITLE = process.env.SHIP_SEED_ROOT_TITLE ?? 'GFA Week 4 — PRD Portfolio';
const BASE_URL = (process.env.SHIP_BASE_URL ?? 'https://ship-web-jyqh.onrender.com').replace(/\/$/, '');
const EMAIL = process.env.SHIP_EMAIL;
const PASSWORD = process.env.SHIP_PASSWORD;
const DRY_RUN = process.env.SHIP_SEED_DRY_RUN === '1' || process.env.SHIP_SEED_DRY_RUN === 'true';
const RESUME = process.env.SHIP_SEED_RESUME === '1' || process.env.SHIP_SEED_RESUME === 'true';
const DELAY_MS = Number(process.env.SHIP_SEED_DELAY_MS ?? '300');
const SOURCE_DIR = path.resolve(
  __dirname,
  process.env.SHIP_SEED_SOURCE_DIR ?? '../../../deliverables/2026-W21-week-01',
);

/** Render WAF may block certain titles; override basename → safe title */
const TITLE_OVERRIDES: Record<string, string> = {
  'DEPLOYMENT_EVIDENCE.md': 'SR-5 Public Host Evidence',
};

type TiptapNode = Record<string, unknown>;
type TiptapDoc = { type: 'doc'; content: TiptapNode[] };

interface WikiDocRow {
  id: string;
  title: string;
  parent_id: string | null;
  properties?: Record<string, unknown>;
}

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(headers: Headers): void {
    const setCookies =
      typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : [headers.get('set-cookie')].filter((v): v is string => Boolean(v));

    for (const raw of setCookies) {
      const pair = raw.split(';')[0]?.trim();
      if (!pair || !pair.includes('=')) continue;
      const [name, ...rest] = pair.split('=');
      if (!name) continue;
      this.cookies.set(name, rest.join('='));
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function titleFromRelativePath(relPath: string): string {
  const normalized = relPath.replace(/\\/g, '/');
  const basename = path.basename(normalized);
  if (TITLE_OVERRIDES[basename]) {
    return TITLE_OVERRIDES[basename].slice(0, 255);
  }
  const withoutExt = normalized.replace(/\.md$/i, '');
  const parts = withoutExt.split('/').map((part) => titleFromDirName(part) || part);
  return parts.join(' › ').slice(0, 255);
}

function titleFromDirName(dirName: string): string {
  return dirName.replace(/_/g, ' ').replace(/-/g, ' ').trim().slice(0, 255);
}

/** Reject readdir names that could escape via path segments or traversal. */
export function isSafeDirEntryName(name: string): boolean {
  if (!name || name.includes('\0')) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  return true;
}

/** Ensure candidatePath resolves inside rootDir (no directory traversal). */
export function assertPathWithinRoot(rootDir: string, candidatePath: string): string {
  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(candidatePath);
  const rel = path.relative(resolvedRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escapes source directory: ${candidatePath}`);
  }
  return resolved;
}

/** Render edge WAF blocks angle brackets and some shell-like patterns in JSON bodies */
function sanitizeMarkdownForTransport(markdown: string): string {
  return markdown
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/curl\s+-i\b/gi, 'curl --include');
}

/** Minimal markdown → TipTap JSON (headings, paragraphs, fenced code, bullet lists). */
export function markdownToTiptap(markdown: string): TiptapDoc {
  const lines = sanitizeMarkdownForTransport(markdown).replace(/\r\n/g, '\n').split('\n');
  const content: TiptapNode[] = [];
  let i = 0;

  const textNode = (text: string, marks?: Array<{ type: string }>) => {
    const node: TiptapNode = { type: 'text', text };
    if (marks?.length) node.marks = marks;
    return node;
  };

  const paragraph = (text: string) => ({
    type: 'paragraph',
    content: text ? [textNode(text)] : [],
  });

  const heading = (level: number, text: string) => ({
    type: 'heading',
    attrs: { level: Math.min(3, level) },
    content: [textNode(text)],
  });

  const codeBlock = (text: string, language = 'markdown') => ({
    type: 'codeBlock',
    attrs: { language },
    content: text ? [textNode(text)] : [],
  });

  const bulletList = (items: string[]) => ({
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [paragraph(item)],
    })),
  });

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i += 1;
      }
      content.push(codeBlock(codeLines.join('\n'), language));
      i += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch?.[1] && headingMatch[2] !== undefined) {
      content.push(heading(headingMatch[1].length, headingMatch[2].trim()));
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*]\s+/, '').trim());
        i += 1;
      }
      content.push(bulletList(items));
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? '';
      if (current.trim() === '' || current.startsWith('```') || /^#{1,6}\s/.test(current) || /^[-*]\s+/.test(current)) {
        break;
      }
      paraLines.push(current);
      i += 1;
    }
    const text = paraLines.join(' ').trim();
    if (text) content.push(paragraph(text));
  }

  if (content.length === 0) {
    content.push(paragraph('(empty source file)'));
  }

  return { type: 'doc', content };
}

interface ShipSession {
  jar: CookieJar;
}

async function fetchJson(
  url: string,
  session: ShipSession,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown; headers: Headers }> {
  const headers = new Headers(init?.headers);
  const cookie = session.jar.header();
  if (cookie) headers.set('cookie', cookie);

  const response = await fetch(url, { ...init, headers });
  session.jar.absorb(response.headers);

  let body: unknown = null;
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  return { ok: response.ok, status: response.status, body, headers: response.headers };
}

async function login(baseUrl: string, email: string, password: string): Promise<ShipSession> {
  const session: ShipSession = { jar: new CookieJar() };

  const csrfRes = await fetchJson(`${baseUrl}/api/csrf-token`, session);
  const csrfBody = csrfRes.body as { token?: string };

  const loginRes = await fetchJson(`${baseUrl}/api/auth/login`, session, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(csrfBody.token ? { 'x-csrf-token': csrfBody.token } : {}),
    },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.body).slice(0, 500)}`);
  }

  if (!session.jar.header().includes('session_id=')) {
    throw new Error('Login succeeded but no session_id cookie was returned');
  }

  return session;
}

async function getCsrfToken(baseUrl: string, session: ShipSession): Promise<string | undefined> {
  const res = await fetchJson(`${baseUrl}/api/csrf-token`, session);
  if (!res.ok) return undefined;
  const data = res.body as { token?: string };
  return data.token;
}

async function listWikiDocs(baseUrl: string, session: ShipSession): Promise<WikiDocRow[]> {
  const res = await fetchJson(`${baseUrl}/api/documents?type=wiki`, session);
  if (!res.ok) {
    throw new Error(`List documents failed (${res.status})`);
  }
  return Array.isArray(res.body) ? (res.body as WikiDocRow[]) : [];
}

async function createWikiDoc(
  baseUrl: string,
  session: ShipSession,
  payload: {
    title: string;
    parent_id?: string | null;
    content?: TiptapDoc;
    properties?: Record<string, unknown>;
  },
): Promise<{ id: string; title: string } | null> {
  if (DRY_RUN) {
    console.log(`[dry-run] would create: ${payload.title}${payload.parent_id ? ` (parent ${payload.parent_id})` : ''}`);
    return { id: `dry-${payload.title}`, title: payload.title };
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const csrf = await getCsrfToken(baseUrl, session);
    const res = await fetchJson(`${baseUrl}/api/documents`, session, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      body: JSON.stringify({
        title: payload.title,
        document_type: 'wiki',
        parent_id: payload.parent_id ?? null,
        visibility: 'workspace',
        content: payload.content ?? null,
        properties: payload.properties ?? {},
      }),
    });

    if (res.ok) {
      const doc = res.body as { id: string; title: string };
      return { id: doc.id, title: doc.title };
    }

    const errText = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    const isCsrf = res.status === 403 && errText.includes('CSRF');
    const isBlocked = res.status === 403 && errText.includes('Blocked');

    if ((isCsrf || isBlocked) && attempt < 3) {
      console.warn(`Retry ${attempt}/3 for "${payload.title}" (${res.status})…`);
      await sleep(DELAY_MS * 3);
      continue;
    }

    console.error(`Failed to create "${payload.title}" (${res.status}):`, errText.slice(0, 400));
    return null;
  }

  return null;
}

async function collectMarkdownFiles(dir: string, baseDir: string): Promise<string[]> {
  const root = path.resolve(baseDir);
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!isSafeDirEntryName(entry.name)) {
      console.warn(`Skipping unsafe directory entry: ${entry.name}`);
      continue;
    }
    const full = assertPathWithinRoot(root, path.join(dir, entry.name));
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(full, root)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files.sort();
}

function buildDirMapFromExisting(docs: WikiDocRow[], rootId: string): Map<string, string> {
  const dirToId = new Map<string, string>();
  dirToId.set('', rootId);
  for (const doc of docs) {
    const seedDir = doc.properties?.seed_source_dir;
    if (typeof seedDir === 'string') {
      dirToId.set(seedDir.replace(/\\/g, '/'), doc.id);
    }
  }
  return dirToId;
}

async function ensureFolderDocs(
  baseUrl: string,
  session: ShipSession,
  rootId: string,
  sourceRoot: string,
  mdFiles: string[],
  existingTitles: Set<string>,
  dirToId: Map<string, string>,
): Promise<Map<string, string>> {

  const relDirs = new Set<string>();
  for (const file of mdFiles) {
    const rel = path.relative(sourceRoot, file);
    const dir = path.dirname(rel);
    if (dir === '.') continue;
    const parts = dir.split(path.sep);
    for (let i = 1; i <= parts.length; i++) {
      relDirs.add(parts.slice(0, i).join(path.sep));
    }
  }

  const sortedDirs = [...relDirs].sort((a, b) => a.localeCompare(b));
  for (const relDir of sortedDirs) {
    if (dirToId.has(relDir)) continue;

    const title = titleFromDirName(path.basename(relDir));
    if (existingTitles.has(title)) {
      const existing = [...dirToId.entries()].find(([, id]) => id); // fallback below
      void existing;
      console.log(`Skip folder doc (title exists): ${title}`);
      continue;
    }
    const parentRel = path.dirname(relDir);
    const parentKey = parentRel === '.' ? '' : parentRel;
    const parentId = dirToId.get(parentKey) ?? rootId;

    const folderDoc = await createWikiDoc(baseUrl, session, {
      title,
      parent_id: parentId,
      content: markdownToTiptap(`# ${title}\n\nIndex folder for Week 4 PRD artifacts (\`${relDir}\`).`),
      properties: { seed_source_dir: relDir, seeded_by: 'seed-remote-wiki-docs' },
    });
    if (folderDoc) {
      dirToId.set(relDir, folderDoc.id);
      existingTitles.add(title);
      console.log(`Folder doc: ${title}`);
      await sleep(DELAY_MS);
    }
  }

  return dirToId;
}

async function main(): Promise<void> {
  if (!EMAIL || !PASSWORD) {
    console.error('Set SHIP_EMAIL and SHIP_PASSWORD environment variables.');
    process.exit(1);
  }

  try {
    await stat(SOURCE_DIR);
  } catch {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const sourceRoot = await realpath(SOURCE_DIR);

  console.log(`Ship remote wiki seed`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Source:   ${sourceRoot}`);
  console.log(`  Dry run:  ${DRY_RUN}`);
  console.log(`  Resume:   ${RESUME}`);

  const session = await login(BASE_URL, EMAIL, PASSWORD);
  console.log('Logged in.');

  const existingDocs = await listWikiDocs(BASE_URL, session);
  const existingTitles = new Set(existingDocs.map((d) => d.title));
  const existingRoot = existingDocs.find((d) => d.title === ROOT_TITLE);

  if (existingRoot && !RESUME) {
    console.log(`Root doc "${ROOT_TITLE}" already exists — aborting to avoid duplicates.`);
    console.log('Set SHIP_SEED_RESUME=1 to add only missing pages.');
    process.exit(0);
  }

  let rootId: string;
  if (existingRoot) {
    rootId = existingRoot.id;
    console.log(`Resume: using existing root (${rootId}).`);
  } else {
    const rootContent = markdownToTiptap(
      `# ${ROOT_TITLE}\n\n` +
        `Seeded from \`deliverables/2026-W21-week-01\` on ${new Date().toISOString().slice(0, 10)}.\n\n` +
        `- Phase 1 PRD bundle\n- Phase 2 PRD bundle\n- PRD CAT 8\n- Core compliance reports\n`,
    );

    const root = await createWikiDoc(BASE_URL, session, {
      title: ROOT_TITLE,
      content: rootContent,
      properties: { seeded_by: 'seed-remote-wiki-docs', seed_root: true },
    });
    if (!root) {
      console.error('Failed to create root portfolio document.');
      process.exit(1);
    }
    rootId = root.id;
    existingTitles.add(ROOT_TITLE);
    console.log(`Root: ${root.title} (${root.id})`);
    await sleep(DELAY_MS);
  }

  const mdFiles = await collectMarkdownFiles(sourceRoot, sourceRoot);
  console.log(`Found ${mdFiles.length} markdown files.`);

  const dirToId = buildDirMapFromExisting(existingDocs, rootId);
  await ensureFolderDocs(BASE_URL, session, rootId, sourceRoot, mdFiles, existingTitles, dirToId);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of mdFiles) {
    const rel = path.relative(sourceRoot, filePath);
    const title = titleFromRelativePath(rel);
    if (existingTitles.has(title)) {
      skipped += 1;
      continue;
    }

    const realPath = await realpath(filePath);
    assertPathWithinRoot(sourceRoot, realPath);
    const markdown = await readFile(realPath, 'utf8');
    const relDir = path.dirname(rel);
    const parentKey = relDir === '.' ? '' : relDir;
    let parentId = dirToId.get(parentKey);
    if (!parentId) {
      parentId = rootId;
      console.warn(`Parent folder not mapped for ${rel}; using root.`);
    }

    const doc = await createWikiDoc(BASE_URL, session, {
      title,
      parent_id: parentId,
      content: markdownToTiptap(markdown),
      properties: {
        seeded_by: 'seed-remote-wiki-docs',
        seed_source_path: rel.replace(/\\/g, '/'),
      },
    });

    if (doc) {
      created += 1;
      existingTitles.add(title);
      console.log(`  + ${rel}`);
      await sleep(DELAY_MS);
    } else {
      failed += 1;
    }
  }

  console.log('\nDone.');
  console.log(`  Created: ${created} wiki pages (+ folder index docs)`);
  console.log(`  Skipped: ${skipped} (duplicate titles)`);
  console.log(`  Failed:  ${failed}`);
  console.log(`\nOpen ${BASE_URL}/documents and look for "${ROOT_TITLE}".`);
}

const executedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (executedDirectly) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
