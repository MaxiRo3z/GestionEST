from datetime import timedelta

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timezone import ahora
from app.modules.auth.models import Usuario


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # hash corrupto/formato inesperado -> nunca autenticar
        return False


def autenticar(db: Session, username: str, password: str) -> Usuario | None:
    usuario = db.scalar(select(Usuario).where(Usuario.username == username))
    if not usuario or not usuario.activo:
        return None
    if not verificar_password(password, usuario.password_hash):
        return None
    return usuario


def crear_token(usuario: Usuario) -> str:
    ahora_local = ahora()
    payload = {
        "sub": str(usuario.id),
        "username": usuario.username,
        # El rol viaja en el propio token (no solo en la tabla) para que los
        # exception_handlers globales (app/main.py) puedan decidir cuánto
        # detalle mostrar sin depender de una consulta a la base -- importante
        # para el caso justo en que el error sea un problema de conexión a
        # la base de datos.
        "rol": usuario.rol,
        "iat": ahora_local,
        "exp": ahora_local + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def crear_usuario(db: Session, username: str, password: str, rol: str = "cliente") -> Usuario:
    existente = db.scalar(select(Usuario).where(Usuario.username == username))
    if existente:
        raise ValueError(f'Ya existe un usuario con el nombre "{username}"')
    usuario = Usuario(username=username, password_hash=hash_password(password), rol=rol)
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def decodificar_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def rol_desde_header(authorization: str | None) -> str:
    """
    Lee el rol directamente del JWT en el header Authorization, sin pasar
    por get_current_user (que requiere una request de FastAPI "normal" con
    sus Depends). Se usa desde los exception_handlers globales de
    app/main.py, que pueden dispararse en cualquier punto del request.

    Por defecto devuelve "cliente" (el mensaje más amigable/menos técnico)
    ante cualquier duda -- token ausente, inválido, vencido, o sin el claim
    "rol" -- para no arriesgarse a mostrarle un detalle técnico a alguien
    sin conocimientos técnicos por error.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return "cliente"
    token = authorization.split(" ", 1)[1].strip()
    payload = decodificar_token(token)
    if not payload:
        return "cliente"
    return payload.get("rol", "cliente")


def cambiar_password(db: Session, usuario: Usuario, password_actual: str, password_nueva: str) -> None:
    if not verificar_password(password_actual, usuario.password_hash):
        raise ValueError("La contraseña actual no es correcta")
    if len(password_nueva) < 8:
        raise ValueError("La contraseña nueva debe tener al menos 8 caracteres")
    usuario.password_hash = hash_password(password_nueva)
    db.commit()
