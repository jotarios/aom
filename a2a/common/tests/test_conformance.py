"""Schema-conformance test (Python side). Asserts every schema.json example
validates against the pydantic model, and that phase/rail/status enums are
exhaustive vs schema.json."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from aom_common.event import AomEvent, Phase, Rail, Status

SCHEMA = json.loads((Path(__file__).resolve().parents[2] / "schema" / "schema.json").read_text())


def test_every_example_validates() -> None:
    examples = SCHEMA["examples"]
    assert examples, "schema has examples"
    for ex in examples:
        AomEvent.model_validate(ex)


def test_phase_enum_exhaustive() -> None:
    assert sorted(p.value for p in Phase) == sorted(SCHEMA["properties"]["phase"]["enum"])


def test_rail_enum_exhaustive() -> None:
    schema_rails = sorted(r for r in SCHEMA["properties"]["rail"]["enum"] if r is not None)
    assert sorted(r.value for r in Rail) == schema_rails


def test_status_enum_exhaustive() -> None:
    assert sorted(s.value for s in Status) == sorted(SCHEMA["properties"]["status"]["enum"])


def test_malformed_rejected() -> None:
    with pytest.raises(Exception):
        AomEvent.model_validate({"phase": "NOPE", "taskId": "0x" + "0" * 64, "status": "pending", "msg": "x"})


def test_bad_task_id_rejected() -> None:
    with pytest.raises(Exception):
        AomEvent.model_validate({"phase": "INTENT", "taskId": "not-hex", "status": "pending", "msg": "x"})


def test_to_wire_stamps_ts() -> None:
    e = AomEvent(phase=Phase.INTENT, taskId="0x" + "0" * 64, status=Status.PENDING, msg="x")
    wire = e.to_wire()
    assert wire["ts"] is not None
