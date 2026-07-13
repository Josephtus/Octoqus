"""
src/services/pubsub.py
======================
Redis Pub/Sub Multiplexer Service.
Prevents "One Connection Per WebSocket" issue by sharing a single 
Redis subscriber connection across multiple WebSocket clients.
"""

import asyncio
import json
import structlog
from typing import Dict, Set
from sanic import Sanic
from redis.asyncio import Redis
from sanic.server.websockets.impl import WebsocketImplProtocol

logger = structlog.get_logger(__name__)

class PubSubManager:
    def __init__(self, redis: Redis):
        self.redis = redis
        self.pubsub = None
        self.channels: Dict[str, Set[WebsocketImplProtocol]] = {}
        self.listener_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def start(self):
        """Starts the global Redis listener task."""
        if self.listener_task and not self.listener_task.done():
            return
        
        self.pubsub = self.redis.pubsub()
        self.listener_task = asyncio.create_task(self._listen())
        logger.info("pubsub.manager.started")

    async def stop(self):
        """Stops the global listener and cleans up."""
        if self.listener_task:
            self.listener_task.cancel()
            try:
                await self.listener_task
            except asyncio.CancelledError:
                pass
        
        if self.pubsub:
            try:
                await self.pubsub.aclose()
            except Exception:
                pass
            self.pubsub = None
        
        logger.info("pubsub.manager.stopped")

    async def _listen(self):
        """Main loop that listens to Redis and broadcasts to WebSockets."""
        # En az bir kanal olması bazı Redis kütüphanelerinde loop'un kilitlenmesini önler
        await self.pubsub.subscribe("__dummy_channel__")
        
        while True:
            try:
                if not self.pubsub:
                    await asyncio.sleep(1)
                    continue

                # get_message() asenkron olarak bekler, mesaj yoksa None döner
                msg = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                
                if msg and msg["type"] == "message":
                    channel = msg["channel"]
                    data = msg["data"]
                    
                    logger.debug("pubsub.received", channel=channel, data_len=len(data))
                    
                    if channel in self.channels:
                        targets = list(self.channels[channel])
                        if not targets:
                            continue

                        async def _safe_send(w, d):
                            try:
                                await w.send(d)
                                return None
                            except Exception as e:
                                logger.warning("pubsub.send_error", error=str(e))
                                return w

                        results = await asyncio.gather(*[_safe_send(ws, data) for ws in targets])
                        
                        disconnected = [r for r in results if r is not None]
                        if disconnected:
                            async with self._lock:
                                for ws in disconnected:
                                    if channel in self.channels and ws in self.channels[channel]:
                                        self.channels[channel].remove(ws)
                
                # Her halükarda event loop'a nefes aldır
                await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("pubsub.listener_error", error=str(exc))
                await asyncio.sleep(2) # Hata durumunda bekle

    async def subscribe(self, channel: str, ws: WebsocketImplProtocol):
        """Subscribes a WebSocket client to a channel."""
        async with self._lock:
            if channel not in self.channels:
                self.channels[channel] = set()
                await self.pubsub.subscribe(channel)
                logger.info("pubsub.subscribed_to_new_channel", channel=channel)
            
            self.channels[channel].add(ws)
            logger.debug("pubsub.client_registered", channel=channel, total_clients=len(self.channels[channel]))

    async def unsubscribe(self, channel: str, ws: WebsocketImplProtocol):
        """Unsubscribes a WebSocket client from a channel."""
        async with self._lock:
            if channel in self.channels:
                if ws in self.channels[channel]:
                    self.channels[channel].remove(ws)
                
                # If no more clients, unsubscribe from Redis to save resources
                if not self.channels[channel]:
                    del self.channels[channel]
                    await self.pubsub.unsubscribe(channel)
                    logger.info("pubsub.unsubscribed_from_channel", channel=channel)
