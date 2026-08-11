from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from app.core.timezone import hoy as hoy_local
from app.db.session import get_db
from app.modules.pagos.models import Cuota
from app.modules.profesores.models import Liquidacion
from app.modules.alumnos.models import Inscripcion

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/alertas")
def alertas(dias_proximos: int = 7, curso_id: int | None = None, db: Session = Depends(get_db)):
    hoy = hoy_local()
    limite = hoy + timedelta(days=dias_proximos)

    # Cuotas vencidas (impagas, fecha ya pasada)
    stmt_vencidas = (
        select(Cuota)
        .join(Cuota.inscripcion)
        .options(joinedload(Cuota.inscripcion).joinedload(Inscripcion.alumno))
        .where(Cuota.estado.in_(["pendiente", "vencida"]), Cuota.fecha_vencimiento < hoy)
        .order_by(Cuota.fecha_vencimiento)
    )
    if curso_id:
        stmt_vencidas = stmt_vencidas.where(Inscripcion.curso_id == curso_id)
    cuotas_vencidas = db.scalars(stmt_vencidas).all()

    # Cuotas por vencer pronto
    stmt_por_vencer = (
        select(Cuota)
        .join(Cuota.inscripcion)
        .options(joinedload(Cuota.inscripcion).joinedload(Inscripcion.alumno))
        .where(Cuota.estado == "pendiente", Cuota.fecha_vencimiento >= hoy, Cuota.fecha_vencimiento <= limite)
        .order_by(Cuota.fecha_vencimiento)
    )
    if curso_id:
        stmt_por_vencer = stmt_por_vencer.where(Inscripcion.curso_id == curso_id)
    cuotas_por_vencer = db.scalars(stmt_por_vencer).all()

    # Matrículas impagas
    stmt_matriculas = (
        select(Inscripcion)
        .options(joinedload(Inscripcion.alumno))
        .where(Inscripcion.matricula_pagada.is_(False), Inscripcion.estado == "activa")
    )
    if curso_id:
        stmt_matriculas = stmt_matriculas.where(Inscripcion.curso_id == curso_id)
    matriculas_pendientes = db.scalars(stmt_matriculas).all()

    # Liquidaciones docentes generadas pero no pagadas.
    # No se filtran por curso_id: una liquidación es mensual por profesor y
    # agrega horas de todos los cursos que dictó ese mes, no pertenece a uno solo.
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
