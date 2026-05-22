from pathlib import Path

from ship_compliance.attestation.manager import parse_front_matter, validate_attestation
from ship_compliance.ci.gates import ExitCode


def test_parse_front_matter_requires_yaml_block() -> None:
    try:
        parse_front_matter("# no yaml")
    except ValueError as exc:
        assert "missing YAML front matter" in str(exc)
    else:
        raise AssertionError("Expected ValueError for missing front matter.")


def test_validate_attestation_missing_file_fails(tmp_path: Path) -> None:
    result = validate_attestation(tmp_path)
    assert result.exit_code == ExitCode.FAIL


def test_validate_attestation_stale_head_fails(monkeypatch: object, tmp_path: Path) -> None:
    attestation = tmp_path / "ATTESTATION.md"
    attestation.write_text(
        """
---
reviewer: Monica Peters
reviewer_email: monica.peters@gfachallenger.gauntletai.com
scan_result: PASS
date: 2026-05-22
timestamp: 2026-05-22T18:45:00Z
---
""".strip(),
        encoding="utf-8",
    )

    values = {
        "rev-parse HEAD": "head-sha",
        f"log -1 --format=%H -- {attestation}": "attestation-sha",
        f"status --porcelain -- {attestation}": "",
    }

    def _fake_run_git(_repo_root: Path, args: list[str]) -> str:
        return values[" ".join(args)]

    monkeypatch.setattr("ship_compliance.attestation.manager._run_git", _fake_run_git)
    result = validate_attestation(tmp_path)
    assert result.exit_code == ExitCode.FAIL
