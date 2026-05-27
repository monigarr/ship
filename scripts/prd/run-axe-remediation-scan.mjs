import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.A11Y_BASE_URL ?? 'http://localhost:5173';
const outputDir = path.resolve('deliverables/2026-W21-week-01/PHASE_2_PRD_BUNDLE/evidence');
const jsonPath = path.join(outputDir, 'c7-axe-remediation.json');
const mdPath = path.join(outputDir, 'c7-axe-remediation.md');

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill('dev@ship.local');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });
}

function summarizeViolations(result) {
  const filtered = result.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }));
  const critical = filtered.filter((v) => v.impact === 'critical').length;
  const serious = filtered.filter((v) => v.impact === 'serious').length;
  return { critical, serious, total: critical + serious, violations: filtered };
}

const pages = [
  { id: 'my-week', path: '/my-week' },
  { id: 'issues', path: '/issues' },
  { id: 'projects', path: '/projects' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await login(page);

const report = [];
for (const pageDef of pages) {
  await page.goto(`${baseUrl}${pageDef.path}`, { waitUntil: 'networkidle' });
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  report.push({
    page: pageDef.path,
    ...summarizeViolations(result),
  });
}

await browser.close();
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const lines = [
  '# Category 7 Axe Remediation Scan',
  '',
  `Base URL: ${baseUrl}`,
  '',
  '| Page | Critical | Serious | Critical+Serious |',
  '| --- | ---: | ---: | ---: |',
  ...report.map((r) => `| ${r.page} | ${r.critical} | ${r.serious} | ${r.total} |`),
  '',
  '## Violation Details',
  ...report.flatMap((r) =>
    r.violations.length === 0
      ? [`- ${r.page}: none`]
      : r.violations.map(
          (v) =>
            `- ${r.page}: [${v.impact}] ${v.id} (${v.nodes} node[s]) targets=${v.targets.join(' | ')}`,
        ),
  ),
  '',
];
fs.writeFileSync(mdPath, lines.join('\n'));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
