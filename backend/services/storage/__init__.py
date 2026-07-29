"""MinIO / S3 object storage for documents, workspaces, artifacts."""

from __future__ import annotations

import hashlib
import json
import mimetypes
import shutil
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4

import boto3
from botocore.client import Config

from services.shared.config import (
    S3_ACCESS_KEY,
    S3_BUCKET_ARTIFACTS,
    S3_BUCKET_BACKUPS,
    S3_BUCKET_DOCUMENTS,
    S3_BUCKET_WORKSPACES,
    S3_ENDPOINT,
    S3_FORCE_PATH_STYLE,
    S3_PRESIGN_GET_EXPIRES,
    S3_PRESIGN_PUT_EXPIRES,
    S3_REGION,
    S3_SECRET_KEY,
    COURSE_MEDIA_OPEN_PREFIX,
    COURSE_MEDIA_SHARED_PREFIX,
    COURSE_MEDIA_SITE_HERO_PREFIX,
    COURSE_MEDIA_SITE_MENTOR_PREFIX,
    DEFAULT_CAMP_ID,
    TEMP_WORKSPACE_ROOT,
    ensure_dirs,
)


@dataclass
class ObjectRef:
    bucket: str
    key: str
    size_bytes: int = 0
    sha256: str | None = None
    content_type: str | None = None

    @property
    def uri(self) -> str:
        return f"s3://{self.bucket}/{self.key}"


class ObjectStore:
    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name=S3_REGION,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path" if S3_FORCE_PATH_STYLE else "auto"}),
        )

    def ensure_buckets(self) -> list[str]:
        created: list[str] = []
        for name in (S3_BUCKET_DOCUMENTS, S3_BUCKET_WORKSPACES, S3_BUCKET_ARTIFACTS, S3_BUCKET_BACKUPS):
            try:
                self._client.head_bucket(Bucket=name)
            except Exception:
                self._client.create_bucket(Bucket=name)
                created.append(name)
            try:
                self._client.put_bucket_versioning(
                    Bucket=name, VersioningConfiguration={"Status": "Enabled"}
                )
            except Exception:
                pass
        return created

    def put_bytes(
        self,
        bucket: str,
        key: str,
        data: bytes,
        content_type: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> ObjectRef:
        sha = hashlib.sha256(data).hexdigest()
        self._client.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
            Metadata=metadata or {"sha256": sha},
        )
        return ObjectRef(bucket=bucket, key=key, size_bytes=len(data), sha256=sha, content_type=content_type)

    def put_file(self, bucket: str, key: str, path: Path, content_type: str | None = None) -> ObjectRef:
        data = path.read_bytes()
        ctype = content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return self.put_bytes(bucket, key, data, content_type=ctype)

    def get_bytes(self, bucket: str, key: str) -> bytes:
        obj = self._client.get_object(Bucket=bucket, Key=key)
        return obj["Body"].read()

    def head(self, bucket: str, key: str) -> dict[str, Any]:
        return self._client.head_object(Bucket=bucket, Key=key)

    def delete(self, bucket: str, key: str) -> None:
        self._client.delete_object(Bucket=bucket, Key=key)

    def presign_put(self, bucket: str, key: str, expires: int | None = None, content_type: str | None = None) -> str:
        exp = S3_PRESIGN_PUT_EXPIRES if expires is None else expires
        params: dict[str, Any] = {"Bucket": bucket, "Key": key}
        if content_type:
            params["ContentType"] = content_type
        return self._client.generate_presigned_url("put_object", Params=params, ExpiresIn=exp)

    def presign_get(self, bucket: str, key: str, expires: int | None = None) -> str:
        exp = S3_PRESIGN_GET_EXPIRES if expires is None else expires
        return self._client.generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=exp
        )

    def list_prefix(self, bucket: str, prefix: str) -> list[str]:
        keys: list[str] = []
        token = None
        while True:
            kwargs: dict[str, Any] = {"Bucket": bucket, "Prefix": prefix}
            if token:
                kwargs["ContinuationToken"] = token
            resp = self._client.list_objects_v2(**kwargs)
            for item in resp.get("Contents") or []:
                keys.append(item["Key"])
            if not resp.get("IsTruncated"):
                break
            token = resp.get("NextContinuationToken")
        return keys


_store: ObjectStore | None = None


def get_store() -> ObjectStore:
    global _store
    if _store is None:
        _store = ObjectStore()
    return _store


def document_key(camp_id: str, document_id: str, sha256: str, filename: str) -> str:
    safe = Path(filename).name.replace("..", "_")
    return f"documents/{camp_id}/{document_id}/{sha256}/{safe}"


def snapshot_prefix(camp_id: str, learner_id: str, snapshot_id: str) -> str:
    return f"workspaces/{camp_id}/{learner_id}/snapshots/{snapshot_id}"


def artifact_key(camp_id: str, learner_id: str, submission_id: str, filename: str) -> str:
    safe = Path(filename).name.replace("..", "_")
    return f"artifacts/{camp_id}/{learner_id}/{submission_id}/{safe}"


def course_media_prefix(camp_id: str | None = None) -> str:
    if camp_id:
        return f"documents/{camp_id}/course-media/"
    return COURSE_MEDIA_SHARED_PREFIX


def course_media_key(filename: str, *, camp_id: str | None = None) -> str:
    safe = Path(filename).name.replace("..", "_")
    return f"{course_media_prefix(camp_id)}{safe}"


def site_hero_key(kind: str, unique: str, ext: str) -> str:
    return f"{COURSE_MEDIA_SITE_HERO_PREFIX}{kind}-{unique}{ext}"


def site_mentor_avatar_key(mentor_id: str, unique: str, ext: str) -> str:
    return f"{COURSE_MEDIA_SITE_MENTOR_PREFIX}{mentor_id}/avatar-{unique}{ext}"


def open_course_key(course_id: str, kind: str, ext: str) -> str:
    return f"{COURSE_MEDIA_OPEN_PREFIX}{course_id}/{kind}{ext}"


def legacy_camp_media_prefix(camp_id: str = DEFAULT_CAMP_ID) -> str:
    return f"documents/{camp_id}/course-media/"


def temp_workspace(camp_id: str, learner_id: str, job_id: str) -> Path:
    ensure_dirs()
    path = TEMP_WORKSPACE_ROOT / camp_id / learner_id / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def hydrate_workspace(camp_id: str, learner_id: str, snapshot_id: str | None, dest: Path) -> int:
    """Download snapshot files into dest directory. Returns file count."""
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    if not snapshot_id:
        return 0
    store = get_store()
    prefix = snapshot_prefix(camp_id, learner_id, snapshot_id) + "/files/"
    keys = store.list_prefix(S3_BUCKET_WORKSPACES, prefix)
    count = 0
    for key in keys:
        rel = key[len(prefix) :]
        if not rel or rel.endswith("/"):
            continue
        target = (dest / rel).resolve()
        if not str(target).startswith(str(dest.resolve())):
            raise ValueError("path escapes workspace")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(store.get_bytes(S3_BUCKET_WORKSPACES, key))
        count += 1
    return count


def snapshot_workspace(
    camp_id: str,
    learner_id: str,
    src: Path,
    *,
    parent_id: str | None = None,
    job_id: str | None = None,
) -> dict[str, Any]:
    """Upload workspace directory as immutable snapshot; return metadata."""
    store = get_store()
    snapshot_id = str(uuid4())
    prefix = snapshot_prefix(camp_id, learner_id, snapshot_id)
    files_meta: list[dict[str, Any]] = []
    total = 0
    if src.exists():
        for path in sorted(src.rglob("*")):
            if not path.is_file():
                continue
            rel = str(path.relative_to(src)).replace("\\", "/")
            data = path.read_bytes()
            total += len(data)
            key = f"{prefix}/files/{rel}"
            ref = store.put_bytes(
                S3_BUCKET_WORKSPACES,
                key,
                data,
                content_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            )
            files_meta.append({"path": rel, "size": len(data), "sha256": ref.sha256, "key": key})
    manifest = {
        "snapshot_id": snapshot_id,
        "camp_id": camp_id,
        "learner_id": learner_id,
        "parent_id": parent_id,
        "job_id": job_id,
        "files": files_meta,
        "size_bytes": total,
        "file_count": len(files_meta),
    }
    manifest_key = f"{prefix}/manifest.json"
    store.put_bytes(
        S3_BUCKET_WORKSPACES,
        manifest_key,
        json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
        content_type="application/json",
    )
    return {
        "id": snapshot_id,
        "manifest_key": manifest_key,
        "object_prefix": prefix,
        "size_bytes": total,
        "file_count": len(files_meta),
        "parent_id": parent_id,
    }


def archive_job_artifact(camp_id: str, learner_id: str, submission_id: str, src: Path) -> list[ObjectRef]:
    store = get_store()
    refs: list[ObjectRef] = []
    if not src.exists():
        return refs
    for path in sorted(src.rglob("*")):
        if not path.is_file():
            continue
        rel = str(path.relative_to(src)).replace("\\", "/")
        key = artifact_key(camp_id, learner_id, submission_id, rel)
        refs.append(store.put_file(S3_BUCKET_ARTIFACTS, key, path))
    return refs
