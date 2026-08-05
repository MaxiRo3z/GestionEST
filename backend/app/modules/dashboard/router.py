from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from app.db.session import get_db
from app.modules.pagos.models import Cuota
from app.modules.profesores.models import Liquidacion
from app.modules.alumnos.models import Inscripcion
from app.modules.gastos.models import Gasto

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/alertas")
def alertas(dias_proximos: int = 7, db: Session = Depends(get_db)):
    hoy = date.today()
    limite = hoy + timedelta(days=dias_proximos)

    # Cuotas vencidas (impagas, fecha ya pasada)
    cuotas_vencidas = db.scalars(
        select(Cuota)
        .options(joinedload(Cuota.inscripcion).joinedload(Inscripcion.alumno))
        .where(Cuota.estado.in_(["pendiente", "vencida"]), Cuota.fecha_vencimiento < hoy)
        .order_by(Cuota.fecha_vencimiento)
    ).all()

    # Cuotas por vencer pronto
    cuotas_por_vencer = db.scalars(
        select(Cuota)
        .options(joinedload(Cuota.inscripcion).joinedload(Inscripcion.alumno))
        .where(Cuota.estado == "pendiente", Cuota.fecha_vencimiento >= hoy, Cuota.fecha_vencimiento <= limite)
        .order_by(Cuota.fecha_vencimiento)
    ).all()

    # Matrículas impagas
    matriculas_pendientes = db.scalars(
        select(Inscripcion)
        .options(joinedload(Inscripcion.alumno))
        .where(Inscripcion.matricula_pagada.is_(False), Inscripcion.estado == "activa")
    ).all()

    # Liquidaciones docentes generadas pero no pagadas
    liquidaciones_pendientes = db.scalars(
        select(Liquidacion).options(joinedload(Liquidacion.profesor)).where(Liquidacion.pagado.is_(False))
    ).all()

    def _cuota_dict(c: Cuota) -> dict:
        return {
            "cuota_id": c.id,
            "numero_cuota": c.numero_cuota,
            "fecha_vencimiento": c.fecha_vencimiento,
            "valor_actualizado": c.valor_actualizado,
            "alumno": f"{c.inscripcion.alumno.nombre} {c.inscripcion.alumno.apellido}",
            "inscripcion_id": c.inscripcion_id,
        }

    return {
        "cuotas_vencidas": [_cuota_dict(c) for c in cuotas_vencidas],
        "cuotas_por_vencer": [_cuota_dict(c) for c in cuotas_por_vencer],
        "matriculas_pendientes": [
            {"inscripcion_id": i.id, "alumno": f"{i.alumno.nombre} {i.alumno.apellido}",
             "valor": i.valor_matricula_congelado}
            for i in matriculas_pendientes
        ],
        "liquidaciones_pendientes": [
            {"liquidacion_id": l.id, "profesor": l.profesor.nombre, "periodo": l.periodo,
             "valor_neto": l.valor_neto}
            for l in liquidaciones_pendientes
        ],
        "resumen": {
            "total_cuotas_vencidas": len(cuotas_vencidas),
            "total_cuotas_por_vencer": len(cuotas_por_vencer),
            "total_matriculas_pendientes": len(matriculas_pendientes),
            "total_liquidaciones_pendientes": len(liquidaciones_pendientes),
        }
    }
