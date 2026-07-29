"""FDE domain model v2 — SQLAlchemy ORM models.

Import this package to register every model on the shared ``Base.metadata``
(useful for Alembic autogenerate and for repositories).
"""

from __future__ import annotations

from services.db.base import Base
from services.models.certificate import CertificateIssuance, CertificateTemplate
from services.models.course import (
    Course,
    CourseModule,
    CourseOffering,
    CourseVersion,
    LearningNode,
)
from services.models.enrollment import (
    EnrollmentRecord,
    Evidence,
    LearningAttempt,
    NodeProgress,
)
from services.models.identity import IdentityVerification, UserProfile
from services.models.user import User
from services.models.resources import (
    LearningResource,
    ResourcePack,
    SubmissionAttachment,
)
from services.models.rubric import RubricCriterion, RubricDefinition
from services.models.workspace import WorkspaceHead, WorkspaceSnapshot

__all__ = [
    "Base",
    "Course",
    "CourseVersion",
    "CourseModule",
    "LearningNode",
    "CourseOffering",
    "EnrollmentRecord",
    "NodeProgress",
    "LearningAttempt",
    "Evidence",
    "WorkspaceHead",
    "WorkspaceSnapshot",
    "RubricDefinition",
    "RubricCriterion",
    "User",
    "UserProfile",
    "IdentityVerification",
    "CertificateTemplate",
    "CertificateIssuance",
    "ResourcePack",
    "LearningResource",
    "SubmissionAttachment",
]
