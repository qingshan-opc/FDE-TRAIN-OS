"""Progress repository (SQLAlchemy Session).

Node progress is keyed by (learner_id, camp_id, day, node_id) for legacy
compatibility, with an optional ``enrollment_id`` for v2 isolation. When an
``enrollment_id`` is provided, reads/writes are scoped to it so two enrollments
of the same user do not clobber each other's progress.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from services.models.enrollment import NodeProgress


class ProgressRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_status(
        self,
        learner_id: str,
        camp_id: str,
        day: int,
        node_id: str,
        enrollment_id: str | None = None,
    ) -> str | None:
        stmt = select(NodeProgress).where(
            NodeProgress.learner_id == learner_id,
            NodeProgress.camp_id == camp_id,
            NodeProgress.day == day,
            NodeProgress.node_id == node_id,
        )
        row = self.session.scalar(stmt)
        if not row:
            return None
        # If caller cares about a specific enrollment, only honor a matching row.
        if enrollment_id is not None and row.enrollment_id not in (None, enrollment_id):
            return None
        return row.status

    def set_status(
        self,
        learner_id: str,
        camp_id: str,
        day: int,
        node_id: str,
        status: str,
        enrollment_id: str | None = None,
    ) -> NodeProgress:
        row = self.session.get(NodeProgress, (learner_id, camp_id, day, node_id))
        now = datetime.now(timezone.utc)
        if row is None:
            row = NodeProgress(
                learner_id=learner_id,
                camp_id=camp_id,
                day=day,
                node_id=node_id,
                status=status,
                updated_at=now,
                enrollment_id=enrollment_id,
            )
            self.session.add(row)
        else:
            row.status = status
            row.updated_at = now
            if enrollment_id is not None:
                row.enrollment_id = enrollment_id
        self.session.flush()
        return row

    def count_passed(
        self, learner_id: str, camp_id: str, day: int, enrollment_id: str | None = None
    ) -> int:
        stmt = select(func.count()).select_from(NodeProgress).where(
            NodeProgress.learner_id == learner_id,
            NodeProgress.camp_id == camp_id,
            NodeProgress.day == day,
            NodeProgress.status == "passed",
        )
        if enrollment_id is not None:
            stmt = stmt.where(NodeProgress.enrollment_id == enrollment_id)
        return int(self.session.scalar(stmt) or 0)

    def backfill_enrollment_id(
        self, learner_id: str, camp_id: str, enrollment_id: str
    ) -> int:
        """Attach an enrollment to any of this learner's rows in a camp that lack one."""
        rows = list(
            self.session.scalars(
                select(NodeProgress).where(
                    NodeProgress.learner_id == learner_id,
                    NodeProgress.camp_id == camp_id,
                    NodeProgress.enrollment_id.is_(None),
                )
            )
        )
        for r in rows:
            r.enrollment_id = enrollment_id
        self.session.flush()
        return len(rows)
