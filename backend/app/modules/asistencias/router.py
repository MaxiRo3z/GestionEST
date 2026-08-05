from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.modules.asistencias.models import AsistenciaAlumno
from app.modules.asistencias.schemas import AsistenciaAlumnoCreate, AsistenciaAlumnoOut

router = APIRouter(prefix="/api/asistencias-alumnos", tags=["Asistencias Alumnos"])


@router.post("", response_model=AsistenciaAlumnoOut, status_code=201)
def cargar_asistencia(data: AsistenciaAlumnoCreate, db: Session = Depends(get_db)):
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
