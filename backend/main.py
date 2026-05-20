import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

print(f"[startup] Python {sys.version}", flush=True)
print(f"[startup] PORT={os.environ.get('PORT', 'NOT SET')}", flush=True)
print(f"[startup] DATABASE_URL={os.environ.get('DATABASE_URL', 'NOT SET (using default)')}", flush=True)
print(f"[startup] ANTHROPIC_API_KEY={'SET' if os.environ.get('ANTHROPIC_API_KEY') else 'NOT SET'}", flush=True)
print(f"[startup] GOOGLE_CLIENT_ID={'SET' if os.environ.get('GOOGLE_CLIENT_ID') else 'NOT SET'}", flush=True)

from database import init_db
from routes import books, recommendations, shelves
from routes.auth import router as auth_router

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads"))

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
print(f"[startup] ALLOWED_ORIGINS={ALLOWED_ORIGINS}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[startup] creating upload dir...", flush=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    print("[startup] running init_db...", flush=True)
    try:
        init_db()
        print("[startup] init_db OK", flush=True)
    except Exception as e:
        print(f"[startup] init_db FAILED: {e}", flush=True)
        raise
    print("[startup] ready", flush=True)
    yield


app = FastAPI(title="Bookshelf Catalog", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(shelves.router)
app.include_router(books.router)
app.include_router(recommendations.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}
