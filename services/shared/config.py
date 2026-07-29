"""FDE shared configuration — production requires PostgreSQL."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_dotenv()

FDE_ENV = os.getenv("FDE_ENV", "dev")
DATA_DIR = Path(os.getenv("FDE_DATA_DIR", str(ROOT / "data")))
WORKSPACE_ROOT = Path(os.getenv("FDE_WORKSPACE_ROOT", str(DATA_DIR / "workspaces")))
ARTIFACT_ROOT = Path(os.getenv("FDE_ARTIFACT_ROOT", str(DATA_DIR / "artifacts")))
CONTRACTS_DIR = Path(os.getenv("FDE_CONTRACTS_DIR", str(ROOT / "contracts" / "examples")))
CONTRACTS_UPLOAD_DIR = Path(os.getenv("FDE_CONTRACTS_UPLOAD_DIR", str(DATA_DIR / "contracts")))
TEMP_WORKSPACE_ROOT = Path(os.getenv("FDE_TEMP_WORKSPACE_ROOT", str(DATA_DIR / "tmp_workspaces")))
DATABASE_URL = os.getenv("DATABASE_URL", "")

LINGZHI_BASE_URL = os.getenv("LINGZHI_BASE_URL", "http://127.0.0.1:8230").rstrip("/")
LINGZHI_API_KEY = os.getenv("LINGZHI_API_KEY", "")
LINGZHI_CLIENT_TOKEN = os.getenv("LINGZHI_CLIENT_TOKEN", "")
LINGZHI_SOURCE_ID = os.getenv("LINGZHI_SOURCE_ID", "")
# anyCode Workbench HTTP (headless AgentRuntime) — not Desktop/UI client
ANYCODE_DASHBOARD_URL = os.getenv("ANYCODE_DASHBOARD_URL", "http://127.0.0.1:43180").rstrip("/")
ANYCODE_API_TOKEN = os.getenv("ANYCODE_API_TOKEN", "")
ANYCODE_COACH_SKILL_ID = os.getenv("ANYCODE_COACH_SKILL_ID", "fde-coach")
ANYCODE_SSE_TIMEOUT_SEC = int(os.getenv("ANYCODE_SSE_TIMEOUT_SEC", "180"))
AGENT_MODE = os.getenv("AGENT_MODE", "auto")  # auto|live|stub
JWT_SECRET = os.getenv("JWT_SECRET", "dev-fde-jwt-secret-change-me")
JWT_TTL_SEC = int(os.getenv("JWT_TTL_SEC", "900"))
REFRESH_TTL_SEC = int(os.getenv("REFRESH_TTL_SEC", str(7 * 86400)))
WORKSPACE_MAX_BYTES = int(os.getenv("FDE_WORKSPACE_MAX_BYTES", str(50 * 1024 * 1024)))
FDE_API_PORT = int(os.getenv("FDE_API_PORT", "8760"))
FDE_DEV_PORT = int(os.getenv("FDE_DEV_PORT", "5173"))
FDE_INTERNAL_BASE = os.getenv("FDE_INTERNAL_BASE", f"http://127.0.0.1:{FDE_API_PORT}").rstrip("/")
DEMO_EMAIL = os.getenv("FDE_DEMO_EMAIL", "demo@fde.local")
DEMO_PASSWORD = os.getenv("FDE_DEMO_PASSWORD", "demo1234")
LEARNER_EMAIL = os.getenv("FDE_LEARNER_EMAIL", "learner@fde.local")
LEARNER_PASSWORD = os.getenv("FDE_LEARNER_PASSWORD", "learner1234")
AUTHOR_EMAIL = os.getenv("FDE_AUTHOR_EMAIL", "author@fde.local")
AUTHOR_PASSWORD = os.getenv("FDE_AUTHOR_PASSWORD", "author1234")
_DEFAULT_CORS = (
    f"http://127.0.0.1:{FDE_API_PORT},http://localhost:{FDE_API_PORT},"
    f"http://127.0.0.1:{FDE_DEV_PORT},http://localhost:{FDE_DEV_PORT}"
)
CORS_ORIGINS = [o.strip() for o in os.getenv("FDE_CORS_ORIGINS", _DEFAULT_CORS).split(",") if o.strip()]
ALLOW_DEV_HEADERS = os.getenv("FDE_ALLOW_DEV_HEADERS", "0") == "1"
SEED_DEMO_USERS = os.getenv("FDE_SEED_DEMO_USERS", "1" if FDE_ENV != "prod" else "0") == "1"

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://127.0.0.1:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "fdeadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "fdeadmin123")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_BUCKET_DOCUMENTS = os.getenv("S3_BUCKET_DOCUMENTS", "fde-documents")
S3_BUCKET_WORKSPACES = os.getenv("S3_BUCKET_WORKSPACES", "fde-workspaces")
S3_BUCKET_ARTIFACTS = os.getenv("S3_BUCKET_ARTIFACTS", "fde-artifacts")
S3_BUCKET_BACKUPS = os.getenv("S3_BUCKET_BACKUPS", "fde-backups")
S3_FORCE_PATH_STYLE = os.getenv("S3_FORCE_PATH_STYLE", "1") == "1"
CLAMAV_ENABLED = os.getenv("CLAMAV_ENABLED", "0") == "1"
DOCUMENT_MAX_BYTES = int(os.getenv("FDE_DOCUMENT_MAX_BYTES", str(30 * 1024 * 1024)))

# KYC adapter (services.application.kyc)
KYC_PROVIDER = os.getenv("KYC_PROVIDER", "stub")  # stub|http
KYC_HTTP_URL = os.getenv("KYC_HTTP_URL", "")

# Certificates: allow issuance without a verified identity outside prod
# (e.g. local demo). In prod this is always false regardless of the env var.
CERT_ALLOW_UNVERIFIED = os.getenv("FDE_CERT_ALLOW_UNVERIFIED", "1" if FDE_ENV != "prod" else "0") == "1"

# Rate limiting (services.shared.rate_limit) — "<count>/<unit>", unit in s|min|hour.
RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "20/min")
RATE_LIMIT_UPLOAD = os.getenv("RATE_LIMIT_UPLOAD", "30/min")
RATE_LIMIT_COACH_ASK = os.getenv("RATE_LIMIT_COACH_ASK", "30/min")
RATE_LIMIT_SQL_EXEC = os.getenv("RATE_LIMIT_SQL_EXEC", "60/min")

# WeChat Pay v3 (billing)
WECHAT_PAY_MCH_ID = os.getenv("WECHAT_PAY_MCH_ID", "")
WECHAT_PAY_APP_ID = os.getenv("WECHAT_PAY_APP_ID", "")
WECHAT_PAY_SERIAL_NO = os.getenv("WECHAT_PAY_SERIAL_NO", "")
WECHAT_PAY_API_V3_KEY = os.getenv("WECHAT_PAY_API_V3_KEY", "")
WECHAT_PAY_PRIVATE_KEY_PATH = os.getenv("WECHAT_PAY_PRIVATE_KEY_PATH", "")
WECHAT_PAY_PLATFORM_CERT_PATH = os.getenv("WECHAT_PAY_PLATFORM_CERT_PATH", "")
FDE_PUBLIC_BASE_URL = os.getenv("FDE_PUBLIC_BASE_URL", FDE_INTERNAL_BASE).rstrip("/")
WECHAT_PAY_SKIP_VERIFY = os.getenv("WECHAT_PAY_SKIP_VERIFY", "0") == "1"
PARTNER_DEMO_EMAIL = os.getenv("FDE_PARTNER_DEMO_EMAIL", "partner@fde.local")
PARTNER_DEMO_PASSWORD = os.getenv("FDE_PARTNER_DEMO_PASSWORD", "partner1234")

# Camp / curriculum identifiers (single source of truth)
DEFAULT_CAMP_ID = os.getenv("FDE_DEFAULT_CAMP_ID", "camp-v03")
CURRICULUM_VERSION_TAG = os.getenv("FDE_CURRICULUM_VERSION_TAG", "v0.7")
SEED_VERSION_TAGS = [t.strip() for t in os.getenv("FDE_SEED_VERSION_TAGS", "v0.7,fde-v07").split(",") if t.strip()]
CAMP_VERSION_LABEL = os.getenv("FDE_CAMP_VERSION_LABEL", "v0.3")

# Object storage key prefixes
COURSE_MEDIA_SHARED_PREFIX = "documents/shared/course-media/"
COURSE_MEDIA_OPEN_PREFIX = "documents/shared/open-courses/"
COURSE_MEDIA_SITE_HERO_PREFIX = "documents/shared/site/hero/"
COURSE_MEDIA_SITE_MENTOR_PREFIX = "documents/shared/site/mentors/"

# Presign / upload limits
S3_PRESIGN_GET_EXPIRES = int(os.getenv("S3_PRESIGN_GET_EXPIRES", "300"))
S3_PRESIGN_PUT_EXPIRES = int(os.getenv("S3_PRESIGN_PUT_EXPIRES", "900"))
MEDIA_MAX_BYTES_BY_KIND: dict[str, int] = {
    "video": int(os.getenv("FDE_MEDIA_MAX_VIDEO_BYTES", str(200 * 1024 * 1024))),
    "audio": int(os.getenv("FDE_MEDIA_MAX_AUDIO_BYTES", str(64 * 1024 * 1024))),
    "poster": int(os.getenv("FDE_MEDIA_MAX_POSTER_BYTES", str(8 * 1024 * 1024))),
    "image": int(os.getenv("FDE_MEDIA_MAX_IMAGE_BYTES", str(8 * 1024 * 1024))),
}
DEFAULT_UPLOAD_MAX_BYTES = int(os.getenv("FDE_DEFAULT_UPLOAD_MAX_BYTES", str(32 * 1024 * 1024)))
LAB_ATTACHMENT_MAX_BYTES = int(os.getenv("FDE_LAB_ATTACHMENT_MAX_BYTES", str(20 * 1024 * 1024)))

# Worker / DB / security tuning
HSTS_MAX_AGE_SEC = int(os.getenv("FDE_HSTS_MAX_AGE_SEC", str(365 * 86400)))
DB_STATEMENT_TIMEOUT_MS = int(os.getenv("DB_STATEMENT_TIMEOUT_MS", "30000"))
MAX_JOB_ATTEMPTS = int(os.getenv("FDE_JOB_MAX_ATTEMPTS", "3"))
JOB_BACKOFF_BASE_SEC = int(os.getenv("FDE_JOB_BACKOFF_BASE_SEC", "30"))
PASSWORD_PBKDF2_ITERATIONS = int(os.getenv("FDE_PASSWORD_PBKDF2_ITERATIONS", "120000"))
ENROLLMENT_ACTIVITY_LIMIT = int(os.getenv("FDE_ENROLLMENT_ACTIVITY_LIMIT", "20"))
API_PAGE_SIZE_MAX = int(os.getenv("FDE_API_PAGE_SIZE_MAX", "100"))

# Bootcamp video pipeline (scripts)
FDE_DHX_ROOT = Path(os.getenv("FDE_DHX_ROOT", str(ROOT.parent / "digital-human-platform")))
FDE_HYPERFRAMES_VERSION = os.getenv("FDE_HYPERFRAMES_VERSION", "0.7.72")


def require_database_url(url: str | None = None) -> str:
    value = url if url is not None else DATABASE_URL
    if not value or not value.startswith("postgres"):
        raise RuntimeError(
            "DATABASE_URL must be a postgresql:// connection string. "
            "SQLite is not supported in application runtime."
        )
    if FDE_ENV == "prod" and JWT_SECRET == "dev-fde-jwt-secret-change-me":
        raise RuntimeError("JWT_SECRET must be changed in production")
    return value


def ensure_dirs() -> None:
    for p in (DATA_DIR, WORKSPACE_ROOT, ARTIFACT_ROOT, CONTRACTS_UPLOAD_DIR, TEMP_WORKSPACE_ROOT):
        p.mkdir(parents=True, exist_ok=True)
