#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const ATTESTATION_PATH = resolve(REPO_ROOT, "ATTESTATION.md");

function fail(message) {
  console.error(`[attestation-check] ${message}`);
  process.exit(1);
}

function parseFrontMatter(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    fail("ATTESTATION.md is missing YAML front matter.");
  }

  const data = {};
  let idx = 1;
  while (idx < lines.length) {
    const line = lines[idx];
    if (line.trim() === "---") break;
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (m) {
      const [, key, rawValue] = m;
      data[key] = rawValue.trim();
    }
    idx += 1;
  }

  if (idx >= lines.length || lines[idx].trim() !== "---") {
    fail("ATTESTATION.md has an unclosed YAML front matter block.");
  }

  return data;
}

function assertRequiredField(frontMatter, key) {
  if (!frontMatter[key] || frontMatter[key].length === 0) {
    fail(`ATTESTATION.md missing required front matter field: ${key}`);
  }
}

function validateDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    fail("ATTESTATION.md field `date` must be ISO format YYYY-MM-DD.");
  }
}

function validateTimestamp(tsValue) {
  // Strict UTC timestamp format.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(tsValue)) {
    fail("ATTESTATION.md field `timestamp` must be ISO-8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).");
  }
}

function checkHeadFreshness() {
  const head = execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  const attestationCommit = execSync("git log -1 --format=%H -- ATTESTATION.md", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
  const attestationDirty = execSync("git status --porcelain -- ATTESTATION.md", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim().length > 0;

  if (!attestationCommit) {
    fail("Could not locate ATTESTATION.md commit history.");
  }

  if (head !== attestationCommit) {
    if (attestationDirty) {
      console.log("[attestation-check] ATTESTATION.md is updated locally and pending commit.");
      return;
    }
    fail(
      [
        "ATTESTATION.md is stale for current HEAD.",
        `HEAD commit: ${head}`,
        `ATTESTATION.md latest commit: ${attestationCommit}`,
        "Update ATTESTATION.md in the same commit as security sign-off changes.",
      ].join("\n"),
    );
  }
}

async function main() {
  if (!existsSync(ATTESTATION_PATH)) {
    fail("ATTESTATION.md does not exist.");
  }

  const content = await readFile(ATTESTATION_PATH, "utf8");
  const frontMatter = parseFrontMatter(content);

  assertRequiredField(frontMatter, "reviewer");
  assertRequiredField(frontMatter, "reviewer_email");
  assertRequiredField(frontMatter, "scan_result");
  assertRequiredField(frontMatter, "date");
  assertRequiredField(frontMatter, "timestamp");

  validateDate(frontMatter.date);
  validateTimestamp(frontMatter.timestamp);

  const scanResult = String(frontMatter.scan_result).toUpperCase();
  if (scanResult !== "PASS") {
    fail("ATTESTATION.md field `scan_result` must be PASS for merge readiness.");
  }

  checkHeadFreshness();
  console.log("[attestation-check] ATTESTATION.md validation passed.");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
