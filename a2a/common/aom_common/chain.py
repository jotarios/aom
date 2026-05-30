"""Shared on-chain helpers: env loading, web3 + contract wiring, hashing."""

from __future__ import annotations

import json
import os
from pathlib import Path

from eth_account import Account
from eth_utils import keccak
from web3 import Web3

_ROOT = Path(__file__).resolve().parents[2]
_ABI_PATH = _ROOT / "shared" / "abi" / "AgentEscrow.json"


def load_env() -> dict[str, str]:
    """Load .env from repo root into a dict (also applied to os.environ)."""
    env_path = _ROOT / ".env"
    out: dict[str, str] = {}
    if env_path.is_file():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k] = v
                os.environ.setdefault(k, v)
    return out


def escrow_abi() -> list[dict[str, object]]:
    return json.loads(_ABI_PATH.read_text())


def make_web3(rpc_url: str) -> Web3:
    return Web3(Web3.HTTPProvider(rpc_url))


def get_contract(w3: Web3, address: str):  # noqa: ANN201 - web3 contract type
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=escrow_abi())


def to_task_id(seed: str) -> bytes:
    """Deterministic bytes32 task id from a seed string."""
    return keccak(text=seed)


def proof_hash(fields: list[str], values: dict[str, object]) -> bytes:
    """keccak256 of the proof fields, concatenated as their string values in order."""
    parts = "".join(str(values.get(f, "")) for f in fields)
    return keccak(text=parts)


def task_commit(spec: str) -> bytes:
    """Commitment to the task spec (hash of params + agreed schema)."""
    return keccak(text=spec)


def account_from_key(private_key: str) -> Account:  # noqa: ANN401
    return Account.from_key(private_key)


def hex32(b: bytes) -> str:
    """0x-prefixed lowercase 64-hex string for the event schema."""
    return "0x" + b.hex().rjust(64, "0")
