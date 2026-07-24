FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 10001 fde \
    && useradd -u 10001 -g fde -m -s /usr/sbin/nologin fde

COPY requirements-skeleton.txt .
RUN pip install --no-cache-dir -r requirements-skeleton.txt

COPY services ./services
COPY contracts ./contracts
COPY migrations ./migrations
COPY prototype ./prototype
COPY scripts ./scripts
COPY sim ./sim
COPY skills ./skills
COPY README.md ./

ENV PYTHONPATH=/app \
    FDE_ENV=prod \
    FDE_API_PORT=8760 \
    FDE_DATA_DIR=/data \
    FDE_WORKSPACE_ROOT=/data/workspaces \
    FDE_ARTIFACT_ROOT=/data/artifacts \
    FDE_TEMP_WORKSPACE_ROOT=/data/tmp_workspaces

RUN mkdir -p /data /tmp && chown -R fde:fde /app /data /tmp

USER 10001:10001

VOLUME ["/data"]
EXPOSE 8760

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD curl -sf http://127.0.0.1:8760/livez || exit 1

CMD ["uvicorn", "services.api.app:app", "--host", "0.0.0.0", "--port", "8760"]
