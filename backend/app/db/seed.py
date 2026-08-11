"""
Carga datos iniciales imprescindibles para operar (métodos de pago, usuario
administrador). Correr con: python -m app.db.seed
Es idempotente: si ya existen, no duplica.
"""
import logging

from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.base import Base  # noqa: F401
from app.modules.pagos.models import MetodoPago
from app.modules.auth.models import Usuario
from app.modules.auth.service import hash_password

logger = logging.getLogger("seed")

METODOS_DEFAULT = [
    {"nombre": "Efectivo", "recargo_pct": 0, "cuotas_max": None},
    {"nombre": "Transferencia bancaria", "recargo_pct": 0, "cuotas_max": None},
    {"nombre": "Tarjeta de Débito", "recargo_pct": 0, "cuotas_max": None},
    {"nombre": "Tarjeta de Crédito", "recargo_pct": 0, "cuotas_max": 0},
]


def _seed_metodos_pago(db) -> None:
    for m in METODOS_DEFAULT:
        existe = db.scalar(select(MetodoPago).where(MetodoPago.nombre == m["nombre"]))
        if not existe:
            db.add(MetodoPago(**m))
    db.commit()


def _seed_admin(db) -> None:
    """Crea el usuario administrador SOLO si todavía no existe ningún
    usuario en la base (para no pisar la contraseña que ya haya cambiado
    el instituto). Las credenciales iniciales salen de ADMIN_USERNAME /
    ADMIN_PASSWORD (.env) -- avisar siempre cambiar la contraseña después
    del primer login con POST /api/auth/cambiar-password."""
    ya_existe_alguno = db.scalar(select(Usuario.id).limit(1))
    if ya_existe_alguno:
        return
    db.add(Usuario(
        username=settings.ADMIN_USERNAME,
        password_hash=hash_password(settings.ADMIN_PASSWORD),
    ))
    db.commit()
    logger.warning(
        "Se creó el usuario administrador '%s' con la contraseña inicial de .env. "
        "Cambiala cuanto antes desde la app (Perfil > Cambiar contraseña).",
        settings.ADMIN_USERNAME,
    )


def run():
    db = SessionLocal()
    try:
        _seed_metodos_pago(db)
        _seed_admin(db)
        print("Seed inicial completado (métodos de pago, usuario administrador).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
