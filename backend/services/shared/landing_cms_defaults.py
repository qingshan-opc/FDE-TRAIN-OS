"""Landing CMS defaults loaded from contracts/site/landing_cms_defaults.json.

Code constants remain the runtime fallback when site_pages.body_json omits keys.

Path resolution supports:
- local repo: backend/services/shared → repo root (parents[3])
- platform image: /app/services/shared → /app (parents[2]) with contracts at /app/contracts
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

_CANDIDATE_ROOTS = (
    Path(__file__).resolve().parents[3],  # .../repo (local: backend/services/shared)
    Path(__file__).resolve().parents[2],  # .../app (docker: /app/services/shared)
    Path.cwd(),
)


def _find_defaults_path() -> Path:
    for root in _CANDIDATE_ROOTS:
        candidate = root / "contracts" / "site" / "landing_cms_defaults.json"
        if candidate.is_file():
            return candidate
    tried = ", ".join(str(r / "contracts/site/landing_cms_defaults.json") for r in _CANDIDATE_ROOTS)
    raise FileNotFoundError(f"landing CMS defaults not found; tried: {tried}")


_DEFAULTS_PATH = _find_defaults_path()

_cached: dict[str, Any] | None = None


def _load() -> dict[str, Any]:
    global _cached
    if _cached is not None:
        return _cached
    with _DEFAULTS_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"landing CMS defaults must be an object: {_DEFAULTS_PATH}")
    _cached = data
    return _cached


LANDING_CMS_DEFAULTS: dict[str, Any] = _load()


def home_defaults() -> dict[str, Any]:
    return deepcopy(LANDING_CMS_DEFAULTS.get("home") or {})


def about_defaults() -> dict[str, Any]:
    return deepcopy(LANDING_CMS_DEFAULTS.get("about") or {})


def footer_defaults() -> dict[str, Any]:
    return deepcopy(LANDING_CMS_DEFAULTS.get("footer") or {})


def partners_defaults() -> list[dict[str, Any]]:
    raw = LANDING_CMS_DEFAULTS.get("partners") or []
    return deepcopy(raw) if isinstance(raw, list) else []


def seo_defaults() -> dict[str, Any]:
    return deepcopy(LANDING_CMS_DEFAULTS.get("seo") or {})


def seo_by_route_defaults() -> dict[str, Any]:
    return deepcopy(LANDING_CMS_DEFAULTS.get("seo_by_route") or {})


def contact_defaults() -> dict[str, Any]:
    return deepcopy(LANDING_CMS_DEFAULTS.get("contact") or {})


def enterprise_facts_defaults() -> list[dict[str, Any]]:
    raw = LANDING_CMS_DEFAULTS.get("enterprise_facts") or []
    return deepcopy(raw) if isinstance(raw, list) else []
