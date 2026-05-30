"""Thin WS hub client for the Python agents: publish events, subscribe to control.

Uses SEPARATE websocket connections for publishing and subscribing. Sharing one
connection across an async-for recv loop and concurrent send() calls lets a slow
handler stall the keepalive/recv path — separate sockets keep both independent.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import websockets

from aom_common.event import AomEvent


class HubClient:
    """A reconnecting publisher/subscriber for the broadcast hub."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._pub: websockets.WebSocketClientProtocol | None = None
        self._sub: websockets.WebSocketClientProtocol | None = None
        self._pub_lock = asyncio.Lock()

    async def connect(self) -> None:
        """Open the publish connection (subscribe connects lazily in messages())."""
        if self._pub is None:
            self._pub = await websockets.connect(self._url, ping_interval=20)

    async def _ensure_pub(self) -> websockets.WebSocketClientProtocol:
        if self._pub is None:
            self._pub = await websockets.connect(self._url, ping_interval=20)
        return self._pub

    async def publish(self, event: AomEvent) -> None:
        async with self._pub_lock:
            try:
                ws = await self._ensure_pub()
                await ws.send(json.dumps(event.to_wire()))
            except (websockets.ConnectionClosed, OSError):
                self._pub = None
                ws = await self._ensure_pub()
                await ws.send(json.dumps(event.to_wire()))

    async def publish_control(self, payload: dict[str, object]) -> None:
        async with self._pub_lock:
            ws = await self._ensure_pub()
            await ws.send(json.dumps(payload))

    async def messages(self) -> AsyncIterator[dict[str, object]]:
        """Yield parsed JSON messages on a DEDICATED connection, reconnecting on drop."""
        while True:
            try:
                if self._sub is None:
                    self._sub = await websockets.connect(self._url, ping_interval=20)
                async for raw in self._sub:
                    try:
                        yield json.loads(raw)
                    except json.JSONDecodeError:
                        continue
            except (websockets.ConnectionClosed, OSError):
                self._sub = None
                await asyncio.sleep(0.5)

    async def close(self) -> None:
        for ws in (self._pub, self._sub):
            if ws is not None:
                await ws.close()
        self._pub = None
        self._sub = None
