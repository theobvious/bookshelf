#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ──────────────────────────────────────────────────────────────────
BACKEND="$ROOT/backend"

if [ ! -f "$BACKEND/.env" ]; then
  echo "⚠️  No $BACKEND/.env found."
  echo "   Copy $BACKEND/.env.example to $BACKEND/.env and add your ANTHROPIC_API_KEY."
  exit 1
fi

if [ ! -d "$BACKEND/.venv" ]; then
  echo "→ Creating Python venv…"
  python3 -m venv "$BACKEND/.venv"
  "$BACKEND/.venv/bin/pip" install -q --upgrade pip
  "$BACKEND/.venv/bin/pip" install -q -r "$BACKEND/requirements.txt"
fi

echo "→ Starting backend on http://localhost:8000"
(cd "$BACKEND" && .venv/bin/uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

# ── Frontend ──────────────────────────────────────────────────────────────────
FRONTEND="$ROOT/frontend"

if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "→ Installing frontend dependencies…"
  (cd "$FRONTEND" && npm install --silent)
fi

echo "→ Starting frontend on http://localhost:5173"
(cd "$FRONTEND" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✅ Bookshelf running!"
echo "   App:  http://localhost:5173"
echo "   API:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
