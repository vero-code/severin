# ============================================================================
# Stage 1: Build React 19 Frontend SPA (Automated, Clean Container Build)
# ============================================================================
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# Install dependencies using lockfile
COPY frontend/package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy frontend source code and compile production distribution
COPY frontend/ ./
RUN npm run build

# ============================================================================
# Stage 2: SEVERIN Python Runtime & FastAPI Server (Track 2A)
# ============================================================================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code, benchmark cache, and datasets
COPY . .

# Copy freshly compiled React SPA distribution from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Expose FastAPI server port
EXPOSE 8000

# Entrypoint: Execute benchmark verification first, then launch FastAPI server
CMD ["sh", "-c", "python -X utf8 src/benchmark.py --mode auto && uvicorn src.server:app --host 0.0.0.0 --port 8000"]
