from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from ship_compliance.ci.gates import ExitCode, GateResult

DEFAULT_PROBE_REPORT_PATH = Path("deliverables/2026-W21-week-01/PRD_CAT8/security-probe-report.json")


def _pnpm_command() -> str:
    for candidate in ("pnpm", "pnpm.cmd"):
        if shutil.which(candidate):
            return candidate
    return "pnpm"


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        parsed = json.load(handle)
    if not isinstance(parsed, dict):
        raise ValueError("probe report root must be a JSON object")
    return parsed


def _determine_report_path(repo_root: Path, env: dict[str, str]) -> Path:
    raw = env.get("SECURITY_PROBE_OUTPUT")
    if raw:
        candidate = Path(raw)
    else:
        candidate = DEFAULT_PROBE_REPORT_PATH
    if candidate.is_absolute():
        return candidate
    return repo_root / candidate


def run_security_probe(repo_root: Path) -> tuple[GateResult, dict[str, Any] | None]:
    env = dict(os.environ)
    report_path = _determine_report_path(repo_root, env)

    try:
        command = [_pnpm_command(), "--filter", "@ship/api", "exec", "tsx", "src/scripts/security-probe.ts"]
        run_kwargs: dict[str, Any] = {
            "cwd": repo_root,
            "capture_output": True,
            "text": True,
            "check": False,
            "env": env,
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
                name="scan",
                exit_code=ExitCode.ERROR,
                message="Unable to run security probe. Ensure pnpm is installed and available in PATH.",
                data={"error": str(exc)},
            ),
            None,
        )
    except Exception as exc:
        return (
            GateResult(
                name="scan",
                exit_code=ExitCode.ERROR,
                message="Security probe command failed unexpectedly.",
                data={"error": str(exc)},
            ),
            None,
        )

    if not report_path.exists():
        return (
            GateResult(
                name="scan",
                exit_code=ExitCode.ERROR,
                message="Security probe completed without producing its JSON report.",
                data={
                    "return_code": completed.returncode,
                    "expected_report": str(report_path),
                    "stderr": (completed.stderr or "").strip(),
                },
            ),
            None,
        )

    try:
        report = _load_json(report_path)
    except Exception as exc:
        return (
            GateResult(
                name="scan",
                exit_code=ExitCode.ERROR,
                message="Could not parse security probe JSON report.",
                data={"error": str(exc), "report_path": str(report_path)},
            ),
            None,
        )

    summary = report.get("summary", {}) if isinstance(report.get("summary"), dict) else {}
    by_status = summary.get("byStatus", {}) if isinstance(summary.get("byStatus"), dict) else {}
    by_severity = summary.get("bySeverity", {}) if isinstance(summary.get("bySeverity"), dict) else {}
    fail_count = int(by_status.get("fail", 0) or 0)
    error_count = int(by_status.get("error", 0) or 0)
    critical_count = int(by_severity.get("critical", 0) or 0)
    high_count = int(by_severity.get("high", 0) or 0)

    has_policy_failures = fail_count > 0 or error_count > 0 or critical_count > 0 or high_count > 0
    message = (
        "Security probe found policy violations."
        if has_policy_failures
        else "Security probe completed without high-risk findings."
    )

    result = GateResult(
        name="scan",
        exit_code=ExitCode.FAIL if has_policy_failures else ExitCode.PASS,
        message=message,
        data={
            "return_code": completed.returncode,
            "report_path": str(report_path),
            "summary": summary,
            "stderr": (completed.stderr or "").strip(),
        },
    )
    return result, report
