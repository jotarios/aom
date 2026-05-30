"""Mirror of scenarios/scenarios.schema.json — the scenario config contract.

Keep in lockstep with the TS mirror in shared/src/scenario.ts.
"""

from __future__ import annotations

import json
import os
import re
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

_SCENARIOS_DIR = Path(__file__).resolve().parents[2] / "scenarios"
_ID_RE = re.compile(r"^[a-z][a-z0-9-]*$")


class ScenarioMode(str, Enum):
    SINGLE = "single"
    RACE = "race"


class PanelKind(str, Enum):
    KEYVALUE = "keyvalue"
    TABLE = "table"
    BALANCE = "balance"


class Story(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hook: str
    agentA: str
    agentB: str
    outcome: str | None = None
    agentBRole: str | None = None
    icon: str | None = None
    agentADesc: str | None = None
    agentBDesc: str | None = None


class AgentBConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)
    label: str
    computeMs: int
    panel: PanelKind
    data: Any


class Proof(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fields: list[str]

    @field_validator("fields")
    @classmethod
    def _non_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("proof.fields must be non-empty")
        return v


class Run(BaseModel):
    model_config = ConfigDict(extra="forbid")
    count: int
    spacingMs: int


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)
    id: str
    mode: ScenarioMode
    wallets: int
    story: Story
    agentB: AgentBConfig
    proof: Proof
    run: Run
    resourceId: str | None = None
    amountMon: str = "0.1"

    @field_validator("id")
    @classmethod
    def _check_id(cls, v: str) -> str:
        if not _ID_RE.match(v):
            raise ValueError(f"bad scenario id: {v}")
        return v

    @model_validator(mode="after")
    def _check_mode(self) -> "Scenario":
        if self.mode == ScenarioMode.RACE.value:
            if self.wallets < 2:
                raise ValueError("race mode requires wallets >= 2")
            if not self.resourceId:
                raise ValueError("race mode requires resourceId")
        return self


def load_scenario(scenario_id: str) -> Scenario:
    if not _ID_RE.match(scenario_id):
        raise ValueError(f"unsafe scenario id: {scenario_id}")
    path = _SCENARIOS_DIR / f"{scenario_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"scenario file not found: {scenario_id}.json")
    parsed = json.loads(path.read_text())
    scenario = Scenario.model_validate(parsed)
    if scenario.id != scenario_id:
        raise ValueError(f"id mismatch: file says {scenario.id}, requested {scenario_id}")
    return scenario


def active_scenario_id() -> str:
    return (os.environ.get("SCENARIO") or "toll").strip()
