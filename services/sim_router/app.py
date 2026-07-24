"""Importable re-export of the hyphenated ``services/sim-router/app.py``.

The implementation dir uses a hyphen (``sim-router``) which is not a valid
Python identifier. This thin package loads that file once via importlib and
re-exports its public symbols so the rest of the codebase can do::

    from services.sim_router.app import router as sim_router
    from services.sim_router.app import evaluate, EvaluateBody
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_IMPL_PATH = Path(__file__).resolve().parents[1] / "sim-router" / "app.py"
_MODULE_NAME = "services.sim_router._impl"

_spec = importlib.util.spec_from_file_location(_MODULE_NAME, _IMPL_PATH)
assert _spec and _spec.loader
_impl = importlib.util.module_from_spec(_spec)
sys.modules[_MODULE_NAME] = _impl
_spec.loader.exec_module(_impl)

# Re-export every public attribute of the implementation module.
globals().update({k: v for k, v in vars(_impl).items() if not k.startswith("__")})

app = _impl.app
router = _impl.router
evaluate = _impl.evaluate
EvaluateBody = _impl.EvaluateBody
