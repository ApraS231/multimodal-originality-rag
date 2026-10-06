import jwt
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

logger = logging.getLogger("AI-Service")
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency helper untuk mengambil token dari header Authorization, mendekode,
    dan memverifikasi tanda tangannya (HS256) menggunakan kunci bersama JWT_SECRET.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Upaya akses ditolak: Token JWT telah kedaluwarsa.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token telah kedaluwarsa"
        )
    except jwt.PyJWTError as e:
        logger.warning(f"Upaya akses ditolak: Token JWT tidak valid ({str(e)}).")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid"
        )

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles
        
    def __call__(self, user: dict = Depends(get_current_user)) -> dict:
        """
        Dependency callable untuk memvalidasi klaim role pengguna.
        Mengembalikan HTTP 403 Forbidden jika role tidak sesuai.
        """
        user_role = user.get("role")
        if user_role not in self.allowed_roles:
            logger.warning(f"Akses ditolak: Pengguna dengan role {user_role} tidak diizinkan mengakses rute ini.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akses ditolak"
            )
        return user
