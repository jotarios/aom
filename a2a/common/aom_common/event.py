"""Mirror of schema/schema.json — the event-stream contract.

Keep field names/enums in lockstep with schema.json, the TS mirror, and the Rust struct.
"""

from __future__ import annotations

import re
import time
from enum import Enum

from pydantic import BaseModel, ConfigDict, field_validator

_HEX64 = re.compile(r"^0x[0-9a-f]{64}$")


class Phase(str, Enum):
    INTENT = "INTENT"
    ESCROW_LOCK = "ESCROW_LOCK"
    INTERCEPT = "INTERCEPT"
    PIPELINE = "PIPELINE"
    SETTLEMENT = "SETTLEMENT"
    REVERTED = "REVERTED"


class Rail(str, Enum):
    RING = "ring"
    RPC = "rpc"


class Status(str, Enum):
    PENDING = "pending"
    COMPUTING = "computing"
    SETTLED = "settled"
    REVERTED = "reverted"


class AomEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=True)

    phase: Phase
    taskId: str
    status: Status
    msg: str
    rail: Rail | None = None
    latencyMs: float | None = None
    reportHash: str | None = None
    txHash: str | None = None
    walletId: str | None = None
    resourceId: str | None = None
    blockNumber: int | None = None
    ts: float | None = None

    @field_validator("taskId")
    @classmethod
    def _check_task_id(cls, v: str) -> str:
        if not _HEX64.match(v):
            raise ValueError(f"taskId must be 0x + 64 lowercase hex: {v}")
        return v

    @field_validator("reportHash", "txHash")
    @classmethod
    def _check_hash(cls, v: str | None) -> str | None:
        if v is not None and not _HEX64.match(v):
            raise ValueError(f"hash must be 0x + 64 lowercase hex: {v}")
        return v

    def to_wire(self) -> dict[str, object]:
        """Serialize to a plain dict for the WS hub, stamping ts if absent."""
        data = self.model_dump()
        if data.get("ts") is None:
            data["ts"] = time.time() * 1000.0
        return data
