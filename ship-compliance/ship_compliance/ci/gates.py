from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any


class ExitCode(IntEnum):
    PASS = 0
    FAIL = 1
    ERROR = 2


@dataclass(slots=True)
class GateResult:
    name: str
    exit_code: ExitCode
    message: str
    data: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.exit_code == ExitCode.PASS


def aggregate_exit_code(results: list[GateResult]) -> ExitCode:
    if any(result.exit_code == ExitCode.ERROR for result in results):
        return ExitCode.ERROR
    if any(result.exit_code == ExitCode.FAIL for result in results):
        return ExitCode.FAIL
    return ExitCode.PASS


def serialize_results(results: list[GateResult]) -> list[dict[str, Any]]:
    return [
        {
            "name": result.name,
            "exit_code": int(result.exit_code),
            "message": result.message,
            "data": result.data,
        }
        for result in results
    ]
