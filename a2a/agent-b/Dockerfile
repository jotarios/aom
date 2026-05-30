# Agent B — Geospatial Engine (Dockerized FastAPI, per PRD §2).
FROM python:3.12-slim

WORKDIR /app

# uv for fast, reproducible installs.
RUN pip install --no-cache-dir uv

# The shared common package + scenarios/data are mounted/copied at the repo root.
COPY common /repo/common
COPY scenarios /repo/scenarios
COPY data /repo/data
COPY schema /repo/schema
COPY shared/abi /repo/shared/abi
COPY agent-b /repo/agent-b

WORKDIR /repo/agent-b
RUN uv pip install --system -e .

ENV SCENARIO=toll
EXPOSE 8000

# Runs the hub-driven engine via the FastAPI lifespan + a /health probe.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
