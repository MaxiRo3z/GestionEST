from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.modules.asistencias.models import AsistenciaAlumno
from app.modules.asistencias.schemas import AsistenciaAlumnoCreate, AsistenciaAlumnoOut

router = APIRouter(prefix="/api/asistencias-alumnos", tags=["Asistencias Alumnos"])


@router.post("", response_model=AsistenciaAlumnoOut, status_code=201)
def cargar_asistencia(data: AsistenciaAlumnoCreate, response: Response, db: Session = Depends(get_db)):
    """Crea la asistencia del día o, si ya existía para esa inscripción/fecha,
    actualiza presente/justificada (permite corregir el registro sin fallar)."""
    existente = db.scalar(
        select(AsistenciaAlumno).where(
            AsistenciaAlumno.inscripcion_id == data.inscripcion_id,
            AsistenciaAlumno.fecha == data.fecha,
        )
    )
    if existente:
        existente.presente = data.presente
        existente.justificada = data.justificada
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(400, "No se pudo actualizar la asistencia")
        db.refresh(existente)
        response.status_code = 200
        return existente

    asistencia = AsistenciaAlumno(**data.model_dump())
    db.add(asistencia)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Ya existe una asistencia cargada para esta inscripción en esa fecha")
    db.refresh(asistencia)
    return asistencia


@router.get("", response_model=list[AsistenciaAlumnoOut])
def listar_asistencias(inscripcion_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(AsistenciaAlumno)
    if inscripcion_id:
        stmt = stmt.where(AsistenciaAlumno.inscripcion_id == inscripcion_id)
    return db.scalars(stmt.order_by(AsistenciaAlumno.fecha.desc())).all()
