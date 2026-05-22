from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from ship_compliance.ci.gates import ExitCode, GateResult

SEVERITIES = {"high", "critical"}


def _pnpm_command() -> str:
    for candidate in ("pnpm", "pnpm.cmd"):
        if shutil.which(candidate):
            return candidate
    return "pnpm"


def _parse_audit_json(candidate: str | None) -> dict[str, Any] | None:
    if not candidate:
        return None
    text = candidate.strip()
    if not text.startswith("{"):
        return None
    parsed = json.loads(text)
    return parsed if isinstance(parsed, dict) else None


def extract_high_critical_findings(parsed: dict[str, Any]) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []

    for package_name, data in (parsed.get("vulnerabilities") or {}).items():
        if not isinstance(data, dict):
            continue
        severity = str(data.get("severity", "")).lower()
        if severity in SEVERITIES:
            findings.append(
                {
                    "id": f"vuln-{package_name}",
                    "package": str(package_name),
                    "severity": severity,
                    "title": f"Vulnerability in {package_name}",
                }
            )

    for advisory_id, data in (parsed.get("advisories") or {}).items():
        if not isinstance(data, dict):
            continue
        severity = str(data.get("severity", "")).lower()
        if severity in SEVERITIES:
            findings.append(
                {
                    "id": f"advisory-{advisory_id}",
                    "package": str(data.get("module_name") or advisory_id),
                    "severity": severity,
                    "title": str(data.get("title") or f"Advisory {advisory_id}"),
                }
            )

    return findings


def run_dependency_audit(repo_root: Path) -> tuple[GateResult, list[dict[str, str]]]:
    try:
        command = [_pnpm_command(), "audit", "--prod", "--json"]
        run_kwargs: dict[str, Any] = {
            "cwd": repo_root,
            "capture_output": True,
            "text": True,
            "check": False,
        }
        if os.name == "nt":
            completed = subprocess.run(
                subprocess.list2cmdline(command),
                shell=True,
                **run_kwargs,
            )
        else:
            completed = subprocess.run(command, **run_kwargs)
    except FileNotFoundError as exc:
        return (
            GateResult(
                name="audit",
                exit_code=ExitCode.ERROR,
                message="Unable to run dependency audit. Ensure pnpm is installed.",
                data={"error": str(exc)},
            ),
            [],
        )
    except Exception as exc:
        return (
            GateResult(
                name="audit",
                exit_code=ExitCode.ERROR,
                message="Dependency audit command failed unexpectedly.",
                data={"error": str(exc)},
            ),
            [],
        )

    parsed = None
    parse_error = None
    for candidate in (completed.stdout, completed.stderr):
        try:
            parsed = _parse_audit_json(candidate)
        except json.JSONDecodeError as exc:
            parse_error = str(exc)
            parsed = None
        if parsed is not None:
            break

    if parsed is None:
        return (
            GateResult(
                name="audit",
                exit_code=ExitCode.ERROR,
                message="Could not parse pnpm audit JSON output.",
                data={
                    "return_code": completed.returncode,
                    "stderr": (completed.stderr or "").strip(),
                    "parse_error": parse_error,
                },
            ),
            [],
        )

    findings = extract_high_critical_findings(parsed)
    if findings:
        return (
            GateResult(
                name="audit",
                exit_code=ExitCode.FAIL,
                message="High or critical production CVEs detected.",
                data={"count": len(findings)},
            ),
            findings,
        )

    return (
        GateResult(
            name="audit",
            exit_code=ExitCode.PASS,
            message="No high or critical production CVEs detected.",
            data={"count": 0},
        ),
        findings,
    )
