#!/usr/bin/env bash
set -e

if [ ! -f "data/corridors.json" ]; then
  echo "No existing data found — seeding demo data..."
  python -m app.seed --reset
else
  echo "Existing data found — skipping seed."
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
