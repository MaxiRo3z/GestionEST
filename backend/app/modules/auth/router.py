from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.modules.auth.deps import get_current_user, require_admin
from app.modules.auth.models import Usuario
from app.modules.auth.schemas import CambiarPasswordIn, LoginIn, TokenOut, UsuarioCreate, UsuarioOut
from app.modules.auth import service

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    usuario = service.autenticar(db, data.username, data.password)
    if not usuario:
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    token = service.crear_token(usuario)
    return TokenOut(access_token=token, expires_in_minutes=settings.JWT_EXPIRE_MINUTES)


@router.get("/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(get_current_user)):
    return usuario


@router.post("/cambiar-password")
def cambiar_password(
    data: CambiarPasswordIn,
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        service.cambiar_password(db, usuario, data.password_actual, data.password_nueva)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"detail": "Contraseña actualizada correctamente"}


# --- Administración de usuarios (solo rol admin) ---
# El rol no restringe el uso del sistema (alumnos, pagos, cursos, etc. son
# de control completo para cualquier usuario logueado); administrar QUIÉN
# puede loguearse sí queda reservado al admin.

@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db), _admin: Usuario = Depends(require_admin)):
    return db.scalars(select(Usuario).order_by(Usuario.username)).all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
def crear_usuario(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    try:
        return service.crear_usuario(db, data.username, data.password, data.rol)
    except ValueError as e:
        raise HTTPException(400, str(e))
