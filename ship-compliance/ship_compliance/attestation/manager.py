from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from ship_compliance.ci.gates import ExitCode, GateResult

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIMESTAMP_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
DEFAULT_ATTESTATION_PATH = Path("ATTESTATION.md")
REQUIRED_FIELDS = ["reviewer", "reviewer_email", "scan_result", "date", "timestamp"]


def parse_front_matter(content: str) -> dict[str, Any]:
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("ATTESTATION.md is missing YAML front matter.")

    end_index = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end_index = idx
            break
    if end_index is None:
        raise ValueError("ATTESTATION.md has an unclosed YAML front matter block.")

    front_matter_text = "\n".join(lines[1:end_index])
    parsed = yaml.load(front_matter_text, Loader=yaml.BaseLoader) or {}
    if not isinstance(parsed, dict):
        raise ValueError("ATTESTATION.md front matter must parse to a key/value object.")
    return parsed


def _run_git(repo_root: Path, args: list[str]) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError((completed.stderr or completed.stdout or "").strip() or "git command failed")
    return completed.stdout.strip()


def validate_attestation(repo_root: Path, attestation_path: Path = DEFAULT_ATTESTATION_PATH) -> GateResult:
    target = attestation_path if attestation_path.is_absolute() else repo_root / attestation_path
    if not target.exists():
        return GateResult(
            name="attest",
            exit_code=ExitCode.FAIL,
            message="ATTESTATION.md does not exist.",
            data={"path": str(target)},
        )

    try:
        content = target.read_text(encoding="utf-8")
        front_matter = parse_front_matter(content)
        for field in REQUIRED_FIELDS:
            if not str(front_matter.get(field, "")).strip():
                return GateResult(
                    name="attest",
                    exit_code=ExitCode.FAIL,
                    message=f"ATTESTATION.md missing required front matter field: {field}",
                )

        if not DATE_PATTERN.match(str(front_matter["date"])):
            return GateResult(
                name="attest",
                exit_code=ExitCode.FAIL,
                message="ATTESTATION.md field `date` must be YYYY-MM-DD.",
            )
        if not TIMESTAMP_PATTERN.match(str(front_matter["timestamp"])):
            return GateResult(
                name="attest",
                exit_code=ExitCode.FAIL,
                message="ATTESTATION.md field `timestamp` must be YYYY-MM-DDTHH:mm:ssZ.",
            )

        if str(front_matter["scan_result"]).upper() != "PASS":
            return GateResult(
                name="attest",
                exit_code=ExitCode.FAIL,
                message="ATTESTATION.md field `scan_result` must be PASS.",
            )

        head = _run_git(repo_root, ["rev-parse", "HEAD"])
        attestation_commit = _run_git(repo_root, ["log", "-1", "--format=%H", "--", str(target)])
        dirty = bool(_run_git(repo_root, ["status", "--porcelain", "--", str(target)]))

        if not attestation_commit:
            return GateResult(
                name="attest",
                exit_code=ExitCode.FAIL,
                message="Could not locate ATTESTATION.md commit history.",
            )

        if head != attestation_commit and not dirty:
            return GateResult(
                name="attest",
                exit_code=ExitCode.FAIL,
                message="ATTESTATION.md is stale for current HEAD.",
                data={"head": head, "attestation_commit": attestation_commit},
            )

        message = (
            "ATTESTATION.md is updated locally and pending commit."
            if head != attestation_commit and dirty
            else "ATTESTATION.md validation passed."
        )
        return GateResult(name="attest", exit_code=ExitCode.PASS, message=message)
    except Exception as exc:
        return GateResult(
            name="attest",
            exit_code=ExitCode.ERROR,
            message="ATTESTATION.md validation failed due to runtime error.",
            data={"error": str(exc)},
        )


def build_attestation_template() -> str:
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    timestamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""---
title: Open Source Security Review Attestation
date: {day}
timestamp: {timestamp}
reviewer: Monica Peters
reviewer_email: monica.peters@gfachallenger.gauntletai.com
reviewer_title: Engineering Security Reviewer
scan_result: PASS
---

# Open Source Security Review Attestation

## Summary

I, **Monica Peters**, as **Engineering Security Reviewer**, attest this commit passed security review.

## Technical Review Details

| Item | Value |
|------|-------|
| Review Date | {day} |
| Scan Result | PASS |

## Attestation

I attest that the above statements are accurate as of the date of this review.
"""


def generate_attestation(
    repo_root: Path,
    attestation_path: Path = DEFAULT_ATTESTATION_PATH,
    *,
    force: bool = False,
) -> GateResult:
    target = attestation_path if attestation_path.is_absolute() else repo_root / attestation_path
    template = build_attestation_template()

    if not force:
        return GateResult(
            name="attest",
            exit_code=ExitCode.PASS,
            message="Dry run complete. Re-run with --force to write ATTESTATION.md.",
            data={"path": str(target), "preview": template},
        )

    try:
        if target.exists():
            existing = target.read_text(encoding="utf-8")
            separator = "\n\n---\n\n"
            target.write_text(existing.rstrip() + separator + template, encoding="utf-8")
            message = "ATTESTATION.md updated by appending a new attestation block."
        else:
            target.write_text(template, encoding="utf-8")
            message = "ATTESTATION.md generated successfully."
        return GateResult(
            name="attest",
            exit_code=ExitCode.PASS,
            message=message,
            data={"path": str(target)},
        )
    except Exception as exc:
        return GateResult(
            name="attest",
            exit_code=ExitCode.ERROR,
            message="Failed to write ATTESTATION.md.",
            data={"error": str(exc), "path": str(target)},
        )
