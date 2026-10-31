FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force
COPY ai-service/requirements-hosted.txt ai-service/requirements-hosted.txt
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r ai-service/requirements-hosted.txt
COPY backend/src backend/src
COPY frontend frontend
COPY database database
COPY ai-service/src ai-service/src
COPY data/legal_sources data/legal_sources
COPY data/search/manifest.json data/search/precedents.sqlite3.gz data/search/
COPY scripts/start_hosted.py scripts/start_hosted.py
RUN mkdir -p /app/runtime/uploads && chown -R node:node /app
ENV PATH="/opt/venv/bin:$PATH" NODE_ENV=production HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 RAG_BACKEND=sqlite \
    AI_SERVICE_URL=http://127.0.0.1:5000 AI_AUTOSTART=false \
    DATA_DIR=/app/runtime UPLOADS_DIR=/app/runtime/uploads
USER node
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python3", "scripts/start_hosted.py"]
