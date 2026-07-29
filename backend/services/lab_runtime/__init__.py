"""M4 — unified LabRuntime abstraction over agent | sim | sql_sandbox runners.

    from services.lab_runtime import LabContext, LabRuntime, LabSession
    from services.lab_runtime.registry import get as get_runtime

    runtime = get_runtime("sql_sandbox")
    session = runtime.create(LabContext(learner_id="u1", camp_id="camp-v03"))
"""

from __future__ import annotations

from services.lab_runtime.base import LabContext, LabRuntime, LabSession  # noqa: F401

__all__ = ["LabContext", "LabRuntime", "LabSession"]
