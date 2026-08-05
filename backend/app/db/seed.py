"""
Carga datos iniciales imprescindibles para operar (métodos de pago).
Correr con: python -m app.db.seed
Es idempotente: si ya existen, no duplica.
"""
from sqlalchemy import select

from app.db.session import SessionLocal
from app.db.base import Base  # noqa: F401
from app.modules.pagos.models import MetodoPago

METODOS_DEFAULT = [
    {"nombre": "Efectivo", "recargo_pct": 0, "cuotas_max": None},
    {"nombre": "Transferencia bancaria", "recargo_pct": 0, "cuotas_max": None},
    {"nombre": "Tarjeta de Débito", "recargo_pct": 3, "cuotas_max": None},
    {"nombre": "Tarjeta de Crédito", "recargo_pct": 15, "cuotas_max": 3},
]


def run():
    db = SessionLocal()
    try:
        for m in METODOS_DEFAULT:
            existe = db.scalar(select(MetodoPago).where(MetodoPago.nombre == m["nombre"]))
            if not existe:
                db.add(MetodoPago(**m))
        db.commit()
        print("Seed de métodos de pago completado.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
