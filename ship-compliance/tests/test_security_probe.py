from pathlib import Path

from ship_compliance.ci.gates import ExitCode
from ship_compliance.scanners.security_probe import DEFAULT_PROBE_REPORT_PATH, run_security_probe


def test_security_probe_missing_pnpm_reports_error(monkeypatch: object, tmp_path: Path) -> None:
    def _raise_file_not_found(*_args: object, **_kwargs: object) -> None:
        raise FileNotFoundError("pnpm")

    monkeypatch.setattr("ship_compliance.scanners.security_probe.subprocess.run", _raise_file_not_found)
    result, report = run_security_probe(tmp_path)
    assert result.exit_code == ExitCode.ERROR
    assert report is None


def test_security_probe_policy_failure_from_summary(monkeypatch: object, tmp_path: Path) -> None:
    report_path = tmp_path / DEFAULT_PROBE_REPORT_PATH
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        """
{
  "summary": {
    "total": 1,
    "byStatus": { "pass": 0, "fail": 1, "warn": 0, "skip": 0, "error": 0 },
    "bySeverity": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 1 }
  }
}
""".strip(),
        encoding="utf-8",
    )

    class Completed:
        returncode = 0
        stderr = ""

    monkeypatch.setattr("ship_compliance.scanners.security_probe.subprocess.run", lambda *_a, **_k: Completed())
    result, report = run_security_probe(tmp_path)
    assert result.exit_code == ExitCode.FAIL
    assert isinstance(report, dict)
