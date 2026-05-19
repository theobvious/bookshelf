import os
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"

_bearer = HTTPBearer(auto_error=False)


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    if not credentials:
        print("[auth] No credentials — Authorization header missing")
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        print(f"[auth] OK — sub={payload.get('sub')} email={payload.get('email')}")
        return payload
    except JWTError as e:
        print(f"[auth] JWTError: {e} | token={credentials.credentials[:40]}...")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
