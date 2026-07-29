"""Project day_packages.package_json into course_modules + learning_nodes.

Runtime still dual-reads package_json; these tables are the structured catalog
index for author tooling, analytics, and future editors.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from services.shared import db_cursor

log = logging.getLogger("fde.curriculum_projection")


def _as_dict(pkg: Any) -> dict[str, Any]:
    if isinstance(pkg, str):
        return json.loads(pkg)
    if isinstance(pkg, dict):
        return dict(pkg)
    return {}


def project_day_package(course_version_id: str, day: int, package_json: dict[str, Any] | str) -> dict[str, Any]:
    """Upsert one module + replace its learning_nodes from a day package."""
    pkg = _as_dict(package_json)
    day_i = int(day)
    title = str(pkg.get("title") or f"Day {day_i}")
    config = {
        "week": pkg.get("week"),
        "project": pkg.get("project"),
        "project_brief": pkg.get("project_brief"),
        "review_checklist": pkg.get("review_checklist") or [],
        "resources": pkg.get("resources") or [],
        "learn": pkg.get("learn") or {},
        "quiz": pkg.get("quiz") or {},
        "lab": pkg.get("lab") or {},
    }

    nodes_raw = pkg.get("nodes") or []
    seen_kinds: set[str] = set()
    node_rows: list[tuple[str, str, str, int, dict[str, Any]]] = []
    for idx, n in enumerate(nodes_raw):
        if not isinstance(n, dict):
            continue
        kind = str(n.get("type") or n.get("kind") or "learn")
        if kind == "unlock":
            continue
        if kind in seen_kinds:
            raise ValueError(f"流程节点类型重复: {kind}")
        seen_kinds.add(kind)
        node_key = f"d{day_i}-{kind}"
        node_title = str(n.get("title") or kind)
        node_cfg: dict[str, Any] = {"source": "package_json.nodes"}
        if kind == "learn":
            node_cfg["capsules"] = (pkg.get("learn") or {}).get("capsules") or []
        elif kind == "quiz":
            node_cfg["quiz"] = pkg.get("quiz") or {}
        elif kind == "lab":
            node_cfg["lab"] = pkg.get("lab") or {}
        elif kind == "project":
            node_cfg["brief"] = pkg.get("project_brief") or ""
            node_cfg["project"] = pkg.get("project")
        elif kind == "review":
            node_cfg["checklist"] = pkg.get("review_checklist") or []
        node_rows.append((node_key, kind, node_title, idx, node_cfg))

    # Capsule-level index nodes (optional secondary keys) — keep primary flow
    # nodes only to avoid breaking UniqueConstraint(module_id, node_key).

    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM course_modules WHERE course_version_id=? AND day_index=?",
            (course_version_id, day_i),
        )
        row = cur.fetchone()
        if row:
            module_id = row["id"]
            cur.execute(
                """
                UPDATE course_modules
                SET title=?, sort_order=?, config_json=?::jsonb
                WHERE id=?
                """,
                (title, day_i, json.dumps(config, ensure_ascii=False), module_id),
            )
            cur.execute("DELETE FROM learning_nodes WHERE module_id=?", (module_id,))
        else:
            module_id = str(uuid4())
            cur.execute(
                """
                INSERT INTO course_modules (id, course_version_id, day_index, title, sort_order, config_json)
                VALUES (?,?,?,?,?,?::jsonb)
                """,
                (module_id, course_version_id, day_i, title, day_i, json.dumps(config, ensure_ascii=False)),
            )

        for node_key, kind, node_title, sort_order, node_cfg in node_rows:
            cur.execute(
                """
                INSERT INTO learning_nodes (id, module_id, node_key, kind, title, sort_order, config_json)
                VALUES (?,?,?,?,?,?,?::jsonb)
                """,
                (
                    str(uuid4()),
                    module_id,
                    node_key,
                    kind,
                    node_title,
                    sort_order,
                    json.dumps(node_cfg, ensure_ascii=False),
                ),
            )

    return {"module_id": module_id, "nodes": len(node_rows)}


def project_course_version(course_version_id: str) -> dict[str, Any]:
    """Re-project every day package for a version."""
    with db_cursor() as cur:
        cur.execute(
            "SELECT day, package_json FROM day_packages WHERE course_version_id=? ORDER BY day",
            (course_version_id,),
        )
        rows = [dict(r) for r in cur.fetchall()]
    projected = []
    for r in rows:
        projected.append(project_day_package(course_version_id, int(r["day"]), r["package_json"]))
    # Drop orphan modules no longer present
    keep_days = {int(r["day"]) for r in rows}
    with db_cursor() as cur:
        cur.execute(
            "SELECT id, day_index FROM course_modules WHERE course_version_id=?",
            (course_version_id,),
        )
        for m in cur.fetchall():
            if int(m["day_index"]) not in keep_days:
                cur.execute("DELETE FROM course_modules WHERE id=?", (m["id"],))
    return {"days": len(projected), "modules": projected}


def delete_projected_day(course_version_id: str, day: int) -> None:
    with db_cursor() as cur:
        cur.execute(
            "DELETE FROM course_modules WHERE course_version_id=? AND day_index=?",
            (course_version_id, int(day)),
        )
