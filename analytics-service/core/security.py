import jwt
from fastapi import Header, HTTPException, Depends

from core.config import settings
from core.db import fetch_df, sanitize

def _decode_token(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    token = authorization[len("Bearer "):]
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_current_user(authorization: str | None = Header(default=None)) -> dict:
                                                     
    decoded = _decode_token(authorization)
    user_id = decoded.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    df = fetch_df("SELECT id, name, email, role FROM users WHERE id = %(id)s", params={"id": user_id})
    if df.empty:
        raise HTTPException(status_code=401, detail="User not found")
    return sanitize(df.iloc[0].to_dict())

def require_roles(*roles):
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dependency

def get_current_vendor(user: dict = Depends(require_roles("vendor"))) -> dict:
                                                      
    df = fetch_df("SELECT * FROM vendors WHERE user_id = %(uid)s", params={"uid": user["id"]})
    if df.empty:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    return sanitize(df.iloc[0].to_dict())
