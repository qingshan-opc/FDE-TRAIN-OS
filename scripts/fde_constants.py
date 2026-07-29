"""Script-side re-exports of services.shared.config — set PYTHONPATH=. when importing."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from services.shared.config import (  # noqa: E402
    COURSE_MEDIA_SHARED_PREFIX,
    CURRICULUM_VERSION_TAG,
    DEFAULT_CAMP_ID,
    FDE_DHX_ROOT,
    FDE_HYPERFRAMES_VERSION,
    SEED_VERSION_TAGS,
)

__all__ = [
    "COURSE_MEDIA_SHARED_PREFIX",
    "CURRICULUM_VERSION_TAG",
    "DEFAULT_CAMP_ID",
    "FDE_DHX_ROOT",
    "FDE_HYPERFRAMES_VERSION",
    "ROOT",
    "SEED_VERSION_TAGS",
]
