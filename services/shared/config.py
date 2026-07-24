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
FDE_INTERNAL_BASE = os.getenv("FDE_INTERNAL_BASE", "http://127.0.0.1:8760").rstrip("/")
DEMO_EMAIL = os.getenv("FDE_DEMO_EMAIL", "demo@fde.local")
DEMO_PASSWORD = os.getenv("FDE_DEMO_PASSWORD", "demo1234")
AUTHOR_EMAIL = os.getenv("FDE_AUTHOR_EMAIL", "author@fde.local")
AUTHOR_PASSWORD = os.getenv("FDE_AUTHOR_PASSWORD", "author1234")
CORS_ORIGINS = [o.strip() for o in os.getenv("FDE_CORS_ORIGINS", "http://127.0.0.1:8760,http://localhost:8760").split(",") if o.strip()]
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
