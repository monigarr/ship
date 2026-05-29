#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function readRepoFile(relPath) {
  const absPath = resolve(REPO_ROOT, relPath);
  if (!existsSync(absPath)) {
    fail(`Missing required file: ${relPath}`);
    return "";
  }
  return readFileSync(absPath, "utf8");
}

function requireMatch(content, regex, file, desc) {
  if (!regex.test(content)) {
    fail(`${file}: missing required contract -> ${desc}`);
  }
}

function requireNoMatch(content, regex, file, desc) {
  if (regex.test(content)) {
    fail(`${file}: detected drift -> ${desc}`);
  }
}

function checkCanonicalScripts() {
  const deployApi = readRepoFile("scripts/deploy-api.sh");
  requireMatch(
    deployApi,
    /DEPRECATION:\s+scripts\/deploy-api\.sh is a compatibility wrapper\./,
    "scripts/deploy-api.sh",
    "deprecation warning"
  );
  requireMatch(
    deployApi,
    /exec "\$SCRIPT_DIR\/deploy\.sh" "\$ENV"/,
    "scripts/deploy-api.sh",
    "must forward to canonical deploy.sh"
  );

  const deployFrontend = readRepoFile("scripts/deploy-frontend.sh");
  requireMatch(
    deployFrontend,
    /DEPRECATION:\s+scripts\/deploy-frontend\.sh is a compatibility wrapper\./,
    "scripts/deploy-frontend.sh",
    "deprecation warning"
  );
  requireMatch(
    deployFrontend,
    /exec "\$SCRIPT_DIR\/deploy-web\.sh" "\$ENV"/,
    "scripts/deploy-frontend.sh",
    "must forward to canonical deploy-web.sh"
  );

  const deployInfra = readRepoFile("scripts/deploy-infrastructure.sh");
  requireMatch(
    deployInfra,
    /DEPRECATION:\s+scripts\/deploy-infrastructure\.sh is a compatibility wrapper\./,
    "scripts/deploy-infrastructure.sh",
    "deprecation warning"
  );
  requireMatch(
    deployInfra,
    /"\$SCRIPT_DIR\/terraform\.sh" "\$ENV" init/,
    "scripts/deploy-infrastructure.sh",
    "must use canonical terraform wrapper"
  );
  requireMatch(
    deployInfra,
    /"\$SCRIPT_DIR\/terraform\.sh" "\$ENV" plan -out=tfplan/,
    "scripts/deploy-infrastructure.sh",
    "must plan via canonical terraform wrapper"
  );
  requireMatch(
    deployInfra,
    /"\$SCRIPT_DIR\/terraform\.sh" "\$ENV" apply tfplan/,
    "scripts/deploy-infrastructure.sh",
    "must apply via canonical terraform wrapper"
  );

  const deploy = readRepoFile("scripts/deploy.sh");
  requireMatch(
    deploy,
    /Usage:\s+\.\/scripts\/deploy\.sh <dev\|shadow\|prod>/,
    "scripts/deploy.sh",
    "canonical usage must include dev|shadow|prod"
  );
  requireMatch(
    deploy,
    /TF_DIR="\$PROJECT_ROOT\/terraform\/environments\/\$ENV"/,
    "scripts/deploy.sh",
    "must use environment-scoped Terraform directory"
  );

  const deployWeb = readRepoFile("scripts/deploy-web.sh");
  requireMatch(
    deployWeb,
    /Usage:\s+\.\/scripts\/deploy-web\.sh <dev\|shadow\|prod>/,
    "scripts/deploy-web.sh",
    "canonical usage must include dev|shadow|prod"
  );
  requireMatch(
    deployWeb,
    /TF_DIR="\$PROJECT_ROOT\/terraform\/environments\/\$ENV"/,
    "scripts/deploy-web.sh",
    "must use environment-scoped Terraform directory"
  );

  const terraform = readRepoFile("scripts/terraform.sh");
  requireMatch(
    terraform,
    /Usage:\s+\.\/scripts\/terraform\.sh <dev\|shadow\|prod> <terraform command>/,
    "scripts/terraform.sh",
    "canonical usage must include dev|shadow|prod"
  );
  requireMatch(
    terraform,
    /TF_DIR="\$PROJECT_ROOT\/terraform\/environments\/\$ENV"/,
    "scripts/terraform.sh",
    "must target terraform/environments/*"
  );
}

function checkDocDrift() {
  const disallowedLegacyPatterns = [
    /\.\/scripts\/deploy-api\.sh/,
    /\.\/scripts\/deploy-frontend\.sh/,
    /\.\/scripts\/deploy-infrastructure\.sh/,
  ];

  const strictDocs = [
    "DEPLOYMENT_CHECKLIST.md",
    "INFRASTRUCTURE_README.md",
    "INFRASTRUCTURE_SUMMARY.md",
    "docs/shadow-env-testing.md",
    ".claude/CLAUDE.md",
    "scripts/copy-db-to-shadow.sh",
    "scripts/copy-db-via-ssm.sh",
  ];

  for (const file of strictDocs) {
    const content = readRepoFile(file);
    for (const pattern of disallowedLegacyPatterns) {
      requireNoMatch(content, pattern, file, `contains deprecated command ${pattern}`);
    }
  }
}

function checkRequiredEnvironmentLayout() {
  const requiredEnvFiles = [
    "terraform/environments/dev/versions.tf",
    "terraform/environments/shadow/versions.tf",
    "terraform/environments/prod/versions.tf",
  ];

  for (const file of requiredEnvFiles) {
    if (!existsSync(resolve(REPO_ROOT, file))) {
      fail(`Missing required environment file: ${file}`);
    }
  }
}

checkCanonicalScripts();
checkDocDrift();
checkRequiredEnvironmentLayout();

if (errors.length > 0) {
  console.error("[aws-deploy-guard] FAILED");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log("[aws-deploy-guard] Passed. Canonical AWS script contract is intact.");
