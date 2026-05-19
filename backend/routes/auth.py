import os
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jose import jwt
from pydantic import BaseModel

from auth import JWT_ALGORITHM, JWT_SECRET

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ALLOWED_EMAILS_RAW = os.environ.get("ALLOWED_EMAILS", "")
ALLOWED_EMAILS = {e.strip().lower() for e in ALLOWED_EMAILS_RAW.split(",") if e.strip()}
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "168"))  # 7 days

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleLoginRequest(BaseModel):
    credential: str


@router.post("/google")
def google_login(body: GoogleLoginRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google client ID not configured")

    try:
        info = id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}")

    email = info.get("email", "").lower()
    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email not verified")

    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail="Access not allowed for this account")

    payload = {
        "sub": info["sub"],
        "email": email,
        "name": info.get("name", ""),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"access_token": token, "email": email, "name": info.get("name", "")}
