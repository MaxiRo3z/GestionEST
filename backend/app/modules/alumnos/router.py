from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.modules.alumnos.models import Alumno, Inscripcion
from app.modules.alumnos.schemas import AlumnoCreate, AlumnoUpdate,AlumnoOut, InscripcionCreate, InscripcionOut
from app.modules.alumnos import service

router = APIRouter(prefix="/api/alumnos", tags=["Alumnos"])


@router.get("", response_model=list[AlumnoOut])
def listar_alumnos(
    response: Response,
    limit: int | None = None,
    offset: int = 0,
    activo: bool | None = None,
    db: Session = Depends(get_db),
):
    """Sin `limit` devuelve la lista completa (así la usan otras pantallas,
    como Cobranzas, para armar el listado de nombres por id). Pasando
    `limit`/`offset` se pagina de verdad: el total real (ya filtrado por
    `activo` si se pasó) viaja en el header X-Total-Count para que el
    frontend arme los controles de página sin cambiar la forma de la
    respuesta."""
    count_stmt = select(func.count()).select_from(Alumno)
    stmt = select(Alumno)
    if activo is not None:
        count_stmt = count_stmt.where(Alumno.activo == activo)
        stmt = stmt.where(Alumno.activo == activo)

    total = db.scalar(count_stmt)
    response.headers["X-Total-Count"] = str(total)

    stmt = stmt.order_by(Alumno.apellido)
    if limit is not None:
        stmt = stmt.offset(offset).limit(limit)
    return db.scalars(stmt).all()


@router.post("", response_model=AlumnoOut, status_code=201)
def crear_alumno(data: AlumnoCreate, db: Session = Depends(get_db)):
    # 1. Buscamos si el DNI ya existe en la base de datos (oculto o no)
    alumno_existente = db.scalar(select(Alumno).where(Alumno.dni == data.dni))
    
    if alumno_existente:
        if not alumno_existente.activo:
            # 2. Si estaba "eliminado", lo resucitamos y actualizamos su info
            for key, value in data.model_dump().items():
                setattr(alumno_existente, key, value)
            alumno_existente.activo = True
            db.commit()
            db.refresh(alumno_existente)
            return alumno_existente
        else:
            # 3. Si ya existe y está activo, devolvemos un error limpio para el Frontend
            raise HTTPException(
                status_code=400, 
                detail="Ya existe un alumno activo registrado con este DNI."
            )
            
    # 4. Si el DNI es totalmente nuevo, lo creamos normalmente
    return service.crear_alumno(db, data)


@router.get("/{alumno_id}", response_model=AlumnoOut)
def obtener_alumno(alumno_id: int, db: Session = Depends(get_db)):
    alumno = db.get(Alumno, alumno_id)
    if not alumno:
        raise HTTPException(404, "Alumno no encontrado")
    return alumno

@router.put("/{alumno_id}", response_model=AlumnoOut)
def editar_alumno(alumno_id: int, data: AlumnoUpdate, db: Session = Depends(get_db)):
    alumno = db.get(Alumno, alumno_id)
    if not alumno:
        raise HTTPException(404, "Alumno no encontrado")
    
    for key, value in data.model_dump().items():
        setattr(alumno, key, value)
        
    db.commit()
    db.refresh(alumno)
    return alumno

# NUEVO: Eliminar alumno
@router.delete("/{alumno_id}", status_code=204)
def eliminar_alumno(alumno_id: int, db: Session = Depends(get_db)):
    alumno = db.get(Alumno, alumno_id)
    if not alumno:
        raise HTTPException(404, "Alumno no encontrado")
    
    # 1. Baja lógica del alumno
    alumno.activo = False
    
    # 2. Navegamos por sus inscripciones usando las relaciones
    for inscripcion in alumno.inscripciones:
        # Usamos el estado "baja" que tenés definido en tu modelo
        inscripcion.estado = "baja"
        
        # 3. Navegamos por las cuotas de esta inscripción
        for cuota in inscripcion.cuotas:
            if cuota.estado in ["pendiente", "vencida"]:
                cuota.estado = "denegada" 
                
    db.commit()
        
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
