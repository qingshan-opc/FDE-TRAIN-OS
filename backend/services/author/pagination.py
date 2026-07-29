"""Shared pagination helpers for Author list APIs."""

from __future__ import annotations

from typing import Any


def parse_page(page: int | str | None = None, page_size: int | str | None = None) -> tuple[int, int]:
    try:
        p = int(page) if page is not None and str(page).strip() != "" else 1
    except (TypeError, ValueError):
        p = 1
    try:
        ps = int(page_size) if page_size is not None and str(page_size).strip() != "" else 20
    except (TypeError, ValueError):
        ps = 20
    if p < 1:
        p = 1
    if ps < 1:
        ps = 20
    if ps > 100:
        ps = 100
    return p, ps


def page_meta(items: list[Any], total: int, page: int, page_size: int) -> dict[str, Any]:
    return {
        "items": items,
        "total": int(total or 0),
        "page": int(page),
        "page_size": int(page_size),
    }


def offset_limit(page: int, page_size: int) -> tuple[int, int]:
    return (page - 1) * page_size, page_size
