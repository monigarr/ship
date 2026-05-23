#!/usr/bin/env node

import { execSync } from "node:child_process";

function extractAuditEntries(parsed) {
  const entries = [];

  for (const [name, data] of Object.entries(parsed.vulnerabilities ?? {})) {
    const severity = String(data?.severity ?? "").toLowerCase();
    if (severity === "high" || severity === "critical") {
      entries.push({
        id: `vuln-${name}`,
        package: name,
        severity,
        title: `Vulnerability in ${name}`,
        via: data?.via,
      });
    }
  }

  for (const [id, data] of Object.entries(parsed.advisories ?? {})) {
    const severity = String(data?.severity ?? "").toLowerCase();
    if (severity === "high" || severity === "critical") {
      entries.push({
        id: `advisory-${id}`,
        package: data?.module_name ?? id,
        severity,
        title: data?.title ?? `Advisory ${id}`,
      });
    }
  }

  return entries;
}

try {
  const stdout = execSync("pnpm audit --prod --json", {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  const parsed = JSON.parse(stdout);
  const findings = extractAuditEntries(parsed);

  if (findings.length > 0) {
    console.error("[dependency-audit] High/Critical production advisories detected:");
    for (const finding of findings) {
      console.error(`- [${finding.severity}] ${finding.package}: ${finding.title}`);
    }
    process.exit(1);
  }

  console.log("[dependency-audit] No High/Critical production advisories detected.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const maybeJson = typeof error === "object" && error !== null && "stdout" in error
    ? String(error.stdout ?? "")
    : "";
  if (maybeJson.trim().startsWith("{")) {
    const parsed = JSON.parse(maybeJson);
    const findings = extractAuditEntries(parsed);
    if (findings.length > 0) {
      console.error("[dependency-audit] High/Critical production advisories detected:");
      for (const finding of findings) {
        console.error(`- [${finding.severity}] ${finding.package}: ${finding.title}`);
      }
      process.exit(1);
    }
    console.log("[dependency-audit] No High/Critical production advisories detected.");
    process.exit(0);
  }

  console.error(`[dependency-audit] Audit command failed: ${message}`);
  process.exit(1);
}
