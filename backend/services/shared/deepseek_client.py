"""DeepSeek Chat Completions client (OpenAI-compatible) for AI task mentor."""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Iterator
from typing import Any

import httpx

log = logging.getLogger("fde.deepseek")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")


def deepseek_configured() -> bool:
    return bool(DEEPSEEK_API_KEY.strip())


def chat_completion(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.4,
    max_tokens: int = 2048,
    timeout: float = 90.0,
) -> str:
    if not deepseek_configured():
        raise RuntimeError("DEEPSEEK_API_KEY 未配置")
    payload: dict[str, Any] = {
        "model": model or DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
        "thinking": {"type": "disabled"},
    }
    with httpx.Client(timeout=timeout) as client:
        r = client.post(
            f"{DEEPSEEK_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"DeepSeek HTTP {r.status_code}: {r.text[:300]}")
        data = r.json()
    choice = (data.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    return str(msg.get("content") or "").strip()


def chat_completion_stream(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.4,
    max_tokens: int = 2048,
    timeout: float = 180.0,
) -> Iterator[str]:
    """Yield text deltas from DeepSeek SSE stream."""
    if not deepseek_configured():
        raise RuntimeError("DEEPSEEK_API_KEY 未配置")
    payload: dict[str, Any] = {
        "model": model or DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
        "thinking": {"type": "disabled"},
    }
    with httpx.Client(timeout=timeout) as client:
        with client.stream(
            "POST",
            f"{DEEPSEEK_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        ) as r:
            if r.status_code >= 400:
                body = r.read().decode("utf-8", errors="replace")[:300]
                raise RuntimeError(f"DeepSeek HTTP {r.status_code}: {body}")
            for line in r.iter_lines():
                if not line:
                    continue
                if line.startswith("data:"):
                    data = line[5:].strip()
                else:
                    continue
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = ((obj.get("choices") or [{}])[0].get("delta") or {})
                text = delta.get("content")
                if text:
                    yield str(text)
