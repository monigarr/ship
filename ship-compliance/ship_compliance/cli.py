from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import typer
from rich.console import Console
from rich.table import Table

from ship_compliance.attestation.manager import generate_attestation, validate_attestation
from ship_compliance.ci.gates import ExitCode, aggregate_exit_code, serialize_results
from ship_compliance.exporters.oscal import export_fedramp_oscal
from ship_compliance.scanners.dependency_audit import run_dependency_audit
from ship_compliance.scanners.security_probe import run_security_probe

app = typer.Typer(help="Federal compliance CLI for Ship monorepo")
export_app = typer.Typer(help="Export compliance artifacts")
app.add_typer(export_app, name="export")
console = Console()


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _print_scan_human(report: dict[str, Any] | None) -> None:
    if not report:
        return
    summary = report.get("summary", {}) if isinstance(report.get("summary"), dict) else {}
    by_status = summary.get("byStatus", {}) if isinstance(summary.get("byStatus"), dict) else {}
    by_severity = summary.get("bySeverity", {}) if isinstance(summary.get("bySeverity"), dict) else {}

    status_table = Table(title="Security Probe Summary")
    status_table.add_column("Metric")
    status_table.add_column("Value", justify="right")
    status_table.add_row("Total Findings", str(summary.get("total", 0)))
    status_table.add_row("Status: pass", str(by_status.get("pass", 0)))
    status_table.add_row("Status: fail", f"[red]{by_status.get('fail', 0)}[/red]")
    status_table.add_row("Status: error", f"[red]{by_status.get('error', 0)}[/red]")
    status_table.add_row("Severity: critical", f"[red]{by_severity.get('critical', 0)}[/red]")
    status_table.add_row("Severity: high", f"[red]{by_severity.get('high', 0)}[/red]")
    status_table.add_row("Severity: medium", f"[yellow]{by_severity.get('medium', 0)}[/yellow]")
    status_table.add_row("Severity: low", str(by_severity.get("low", 0)))
    status_table.add_row("Severity: info", str(by_severity.get("info", 0)))
    console.print(status_table)


def _print_audit_human(findings: list[dict[str, str]]) -> None:
    if not findings:
        console.print("[green]No high/critical production CVEs detected.[/green]")
        return

    table = Table(title="Dependency Audit Findings")
    table.add_column("Severity")
    table.add_column("Package")
    table.add_column("Title")
    for finding in findings:
        severity = finding.get("severity", "unknown")
        color = "red" if severity in {"critical", "high"} else "yellow"
        table.add_row(f"[{color}]{severity}[/{color}]", finding.get("package", ""), finding.get("title", ""))
    console.print(table)


@app.command()
def scan(json_output: bool = typer.Option(False, "--json", help="Emit machine-readable JSON output")) -> None:
    """Run security probe against running app."""
    result, report = run_security_probe(_repo_root())
    if json_output:
        console.print_json(
            json.dumps(
                {
                    "result": {
                        "name": result.name,
                        "exit_code": int(result.exit_code),
                        "message": result.message,
                        "data": result.data,
                    },
                    "report": report,
                }
            )
        )
    else:
        console.print(result.message)
        _print_scan_human(report)
    raise typer.Exit(int(result.exit_code))


@app.command()
def audit(json_output: bool = typer.Option(False, "--json", help="Emit machine-readable JSON output")) -> None:
    """Run production dependency audit."""
    result, findings = run_dependency_audit(_repo_root())
    if json_output:
        console.print_json(
            json.dumps(
                {
                    "result": {
                        "name": result.name,
                        "exit_code": int(result.exit_code),
                        "message": result.message,
                        "data": result.data,
                    },
                    "findings": findings,
                }
            )
        )
    else:
        console.print(result.message)
        _print_audit_human(findings)
    raise typer.Exit(int(result.exit_code))


@app.command()
def attest(
    check: bool = typer.Option(False, "--check", help="Validate ATTESTATION.md freshness and fields"),
    generate: bool = typer.Option(False, "--generate", help="Generate attestation content"),
    force: bool = typer.Option(False, "--force", help="Write ATTESTATION.md when used with --generate"),
    json_output: bool = typer.Option(False, "--json", help="Emit machine-readable JSON output"),
) -> None:
    """Validate or generate ATTESTATION.md."""
    repo_root = _repo_root()
    run_check = check or (not check and not generate)
    result = validate_attestation(repo_root) if run_check else generate_attestation(repo_root, force=force)
    payload = {
        "name": result.name,
        "exit_code": int(result.exit_code),
        "message": result.message,
        "data": result.data,
    }
    if json_output:
        console.print_json(json.dumps(payload))
    else:
        console.print(result.message)
        if result.data.get("preview"):
            console.print(result.data["preview"])
    raise typer.Exit(int(result.exit_code))


@export_app.command("fedramp")
def export_fedramp(
    output: Optional[Path] = typer.Option(None, "--output", help="Output OSCAL JSON path"),
    strict: bool = typer.Option(False, "--strict", help="Fail export when warnings are present"),
    json_output: bool = typer.Option(False, "--json", help="Emit machine-readable JSON output"),
) -> None:
    """Export FedRAMP OSCAL artifacts."""
    result, document, resolved_path = export_fedramp_oscal(_repo_root(), output, strict=strict)
    payload = {
        "name": result.name,
        "exit_code": int(result.exit_code),
        "message": result.message,
        "path": str(resolved_path),
        "warnings": result.data.get("warnings", []),
        "document": document,
    }
    if json_output:
        console.print_json(json.dumps(payload))
    else:
        console.print(result.message)
        console.print(f"Output: {resolved_path}")
        if result.data.get("warnings"):
            for warning in result.data["warnings"]:
                console.print(f"[yellow]- {warning}[/yellow]")
    raise typer.Exit(int(result.exit_code))


@app.command()
def ci(json_output: bool = typer.Option(False, "--json", help="Emit machine-readable JSON output")) -> None:
    """Run all checks in CI mode."""
    repo_root = _repo_root()
    scan_result, _ = run_security_probe(repo_root)
    attest_result = validate_attestation(repo_root)
    audit_result, _ = run_dependency_audit(repo_root)
    results = [scan_result, attest_result, audit_result]
    exit_code = aggregate_exit_code(results)

    if json_output:
        console.print_json(json.dumps({"results": serialize_results(results), "exit_code": int(exit_code)}))
    else:
        table = Table(title="CI Gate Results")
        table.add_column("Check")
        table.add_column("Exit")
        table.add_column("Message")
        for result in results:
            color = "green" if result.exit_code == ExitCode.PASS else "red" if result.exit_code == ExitCode.FAIL else "yellow"
            table.add_row(result.name, f"[{color}]{int(result.exit_code)}[/{color}]", result.message)
        console.print(table)
    raise typer.Exit(int(exit_code))


if __name__ == "__main__":
    app()
