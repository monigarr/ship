# Security Policy

## Reporting a Vulnerability

The U.S. Department of the Treasury takes security seriously. If you discover a security vulnerability in this project, please report it responsibly.

### How to Report

**Do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities through one of these channels:

1. **Email**: Sam Corcos (samuel.corcos@treasury.gov)
2. **GitHub Security Advisories**: Use the "Report a vulnerability" button in the Security tab

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Resolution Timeline**: Depends on severity

### Scope

This security policy applies to:
- The main repository code
- Official releases
- Documentation

### Out of Scope

- Third-party dependencies (report to upstream maintainers)
- Self-hosted instances with custom modifications

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Security Best Practices

When deploying Ship:

1. Keep dependencies updated
2. Use environment variables for sensitive configuration
3. Enable HTTPS in production
4. Follow your organization's security guidelines

## Development Security

### Pre-commit Compliance Checks

This repository uses fail-closed pre-commit hooks that run Dockerized security scanners:

- **Secrets**: API keys, passwords, tokens (via `gitleaks` on staged changes)
- **Sensitive Information**: hardcoded sensitive patterns (via `trivy` secret scanner)
- **Misconfiguration**: IaC/container config security issues (via `trivy` misconfig scanner)

The official compliance-docs tool for this repository is [strongdm/comply](https://github.com/strongdm/comply). It is used for documentation/compliance workflows, not as the pre-commit security scanner engine.

#### Windows + WSL Docker setup (required for local hooks)

If pre-commit reports `docker` not found from Bash/WSL:

1. Open Docker Desktop -> **Settings** -> **Resources** -> **WSL Integration**.
2. Enable integration for the distro used by this repository.
3. Restart Docker Desktop.
4. From your Bash/WSL shell, verify Docker access:
   - `docker --version` or `docker.exe --version`
5. Re-run hook validation:
   - `bash .husky/pre-commit`

The hook streams staged content into Dockerized scanners instead of bind-mounting the repository. This keeps Windows drive permissions from weakening the fail-closed scanner behavior.

### NEVER Bypass Security Checks

**`git commit --no-verify` is prohibited.** This flag bypasses all pre-commit hooks and defeats the security scanning.

If you encounter a situation where you're tempted to use `--no-verify`:

| Situation | Correct Action |
|-----------|----------------|
| False positive from gitleaks | Add to `.gitleaksignore` and re-run |
| Scanner/tool crashes | Fix local Docker/scanner setup first; do not bypass hooks |
| Need to commit urgently | No exception. Fix the issue first. |
| CI is down | Local hooks still work. CI is backup enforcement. |

### CI Enforcement

GitHub Actions provides a second layer of enforcement:

- **secrets-scan**: Runs gitleaks on every PR
- **attestation-check**: Verifies `ATTESTATION.md` exists, contains required fields, and is updated at `HEAD`

These are required status checks. PRs cannot merge without passing.

### Attestation

Every commit to main should have an associated security attestation in `ATTESTATION.md`. This file:

- Records who performed the security review
- Documents which scanning tools were used
- Provides audit trail for FISMA compliance

Update `ATTESTATION.md` when your branch is ready for release/security sign-off.

Minimum attestation freshness rule enforced by CI:

- `git log -1 --format=%H -- ATTESTATION.md` **must match** `git rev-parse HEAD`
- Front matter must include: `reviewer`, `reviewer_email`, `scan_result`, `date`, `timestamp`
- `scan_result` must be `PASS`
