"""Importable re-export of the hyphenated ``services/coach-gateway/app.py``.

The implementation dir uses a hyphen (``coach-gateway``) which is not a valid
Python identifier, so it cannot be imported with a normal ``import`` statement.
This thin package loads that file once via importlib and re-exports its public
symbols (notably ``app`` and ``router``) so the rest of the codebase can do::

    from services.coach_gateway.app import router as coach_router
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_IMPL_PATH = Path(__file__).resolve().parents[1] / "coach-gateway" / "app.py"
_MODULE_NAME = "services.coach_gateway._impl"

_spec = importlib.util.spec_from_file_location(_MODULE_NAME, _IMPL_PATH)
assert _spec and _spec.loader
_impl = importlib.util.module_from_spec(_spec)
sys.modules[_MODULE_NAME] = _impl
_spec.loader.exec_module(_impl)

# Re-export every public attribute of the implementation module.
globals().update({k: v for k, v in vars(_impl).items() if not k.startswith("__")})

app = _impl.app
router = _impl.router
