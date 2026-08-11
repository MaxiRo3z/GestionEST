from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.models import Usuario
from app.modules.auth.service import decodificar_token

# auto_error=False para poder devolver un 401 con nuestro propio mensaje
# (en vez del genérico "Not authenticated" de FastAPI) cuando falta el header.
_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado. Iniciá sesión de nuevo.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decodificar_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión expiró o el token no es válido. Iniciá sesión de nuevo.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    usuario = db.get(Usuario, int(payload["sub"]))
    if usuario is None or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inválido o inactivo.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return usuario


def require_admin(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    """Para las pocas acciones que sí distinguen por rol (hoy: administrar
    usuarios). El resto del sistema es de control completo para cualquier
    usuario logueado, sea admin o cliente."""
    if usuario.rol != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta acción requiere un usuario administrador.")
    return usuario
