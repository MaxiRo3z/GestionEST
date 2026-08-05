from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.modules.alumnos.models import Alumno, Inscripcion
from app.modules.alumnos.schemas import AlumnoCreate, AlumnoOut, InscripcionCreate, InscripcionOut
from app.modules.alumnos import service

router = APIRouter(prefix="/api/alumnos", tags=["Alumnos"])


@router.get("", response_model=list[AlumnoOut])
def listar_alumnos(db: Session = Depends(get_db)):
    return db.scalars(select(Alumno).order_by(Alumno.apellido)).all()


@router.post("", response_model=AlumnoOut, status_code=201)
def crear_alumno(data: AlumnoCreate, db: Session = Depends(get_db)):
    return service.crear_alumno(db, data)


@router.get("/{alumno_id}", response_model=AlumnoOut)
def obtener_alumno(alumno_id: int, db: Session = Depends(get_db)):
    alumno = db.get(Alumno, alumno_id)
    if not alumno:
        raise HTTPException(404, "Alumno no encontrado")
    return alumno


inscripciones_router = APIRouter(prefix="/api/inscripciones", tags=["Inscripciones"])


@inscripciones_router.get("", response_model=list[InscripcionOut])
def listar_inscripciones(db: Session = Depends(get_db)):
    return db.scalars(select(Inscripcion)).all()


@inscripciones_router.post("", response_model=InscripcionOut, status_code=201)
def crear_inscripcion(data: InscripcionCreate, db: Session = Depends(get_db)):
    try:
        return service.crear_inscripcion(db, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@inscripciones_router.get("/{inscripcion_id}", response_model=InscripcionOut)
def obtener_inscripcion(inscripcion_id: int, db: Session = Depends(get_db)):
    insc = db.get(Inscripcion, inscripcion_id)
    if not insc:
        raise HTTPException(404, "Inscripción no encontrada")
    return insc
