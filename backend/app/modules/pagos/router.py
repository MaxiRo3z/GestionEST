import uuid
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.db.session import get_db
from app.modules.pagos.models import Cuota, MetodoPago, Pago
from app.modules.pagos.schemas import (
    MetodoPagoCreate, MetodoPagoOut, CuotaOut,
    RegistrarPagoCuotaIn, RegistrarPagoMatriculaIn, PagoOut,
)
from app.modules.pagos import service

# NUEVAS IMPORTACIONES PARA EL COMPROBANTE
from app.modules.comprobantes.models import Comprobante
from app.modules.alumnos.models import Inscripcion

router = APIRouter(prefix="/api/pagos", tags=["Pagos"])

# ---- Métodos de pago ----
@router.get("/metodos", response_model=list[MetodoPagoOut])
def listar_metodos(db: Session = Depends(get_db)):
    return db.scalars(select(MetodoPago)).all()

@router.post("/metodos", response_model=MetodoPagoOut, status_code=201)
def crear_metodo(data: MetodoPagoCreate, db: Session = Depends(get_db)):
    metodo = MetodoPago(**data.model_dump())
    db.add(metodo)
    db.commit()
    db.refresh(metodo)
    return metodo

# ---- Cuotas ----
@router.get("/cuotas", response_model=list[CuotaOut])
def listar_cuotas(inscripcion_id: int | None = None, estado: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Cuota)
    if inscripcion_id:
        stmt = stmt.where(Cuota.inscripcion_id == inscripcion_id)
    if estado:
        stmt = stmt.where(Cuota.estado == estado)
    return db.scalars(stmt.order_by(Cuota.fecha_vencimiento)).all()

@router.post("/cuotas/{cuota_id}/pagar", response_model=PagoOut)
def pagar_cuota(cuota_id: int, data: RegistrarPagoCuotaIn, db: Session = Depends(get_db)):
    try:
        # 1. Procesamos el pago normal
        pago = service.registrar_pago_cuota(db, cuota_id, data)
        
        # 2. Buscamos a quién pertenece para el comprobante
        cuota = db.get(Cuota, cuota_id)
        inscripcion = db.get(Inscripcion, cuota.inscripcion_id)
        
        # 3. Generamos el comprobante en la base de datos
        comp = Comprobante(
            tipo="cuota",
            referencia_id=pago.id,
            alumno_id=inscripcion.alumno_id,
            numero_comprobante=f"CUA-{pago.id}-{uuid.uuid4().hex[:4].upper()}"
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)
        
        # 4. Inyectamos el ID en el objeto para que Pydantic se lo envíe al Frontend
        setattr(pago, "comprobante_id", comp.id)
        
        return pago
    except ValueError as e:
        raise HTTPException(400, str(e))

# ---- Matrícula ----
@router.post("/matricula/pagar", response_model=PagoOut)
def pagar_matricula(data: RegistrarPagoMatriculaIn, db: Session = Depends(get_db)):
    try:
        # 1. Procesamos el pago normal
        pago = service.registrar_pago_matricula(db, data)
        
        # 2. Buscamos la inscripción
        inscripcion = db.get(Inscripcion, data.inscripcion_id)
        
        # 3. Generamos el comprobante
        comp = Comprobante(
            tipo="matricula",
            referencia_id=pago.id,
            alumno_id=inscripcion.alumno_id,
            numero_comprobante=f"MAT-{pago.id}-{uuid.uuid4().hex[:4].upper()}"
        )
        db.add(comp)
        db.commit()
        db.refresh(comp)
        
        setattr(pago, "comprobante_id", comp.id)
        
        return pago
    except ValueError as e:
        raise HTTPException(400, str(e))

# ---- Listado general de pagos ----
@router.get("", response_model=list[PagoOut])
def listar_pagos(
    response: Response,
    limit: int | None = None,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Igual que /api/alumnos: sin `limit` devuelve todo (compatibilidad),
    con `limit`/`offset` pagina y el total viaja en X-Total-Count."""
    total = db.scalar(select(func.count()).select_from(Pago))
    response.headers["X-Total-Count"] = str(total)

    stmt = select(Pago).order_by(Pago.fecha_pago.desc())
    if limit is not None:
        stmt = stmt.offset(offset).limit(limit)
    return db.scalars(stmt).all()

@router.post("/marcar-vencidas")
def marcar_vencidas(db: Session = Depends(get_db)):
    n = service.marcar_cuotas_vencidas(db)
    return {"cuotas_marcadas_vencidas": n}
