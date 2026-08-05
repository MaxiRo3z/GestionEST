from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.modules.pagos.models import Cuota, MetodoPago, Pago
from app.modules.pagos.schemas import (
    MetodoPagoCreate, MetodoPagoOut, CuotaOut,
    RegistrarPagoCuotaIn, RegistrarPagoMatriculaIn, PagoOut,
)
from app.modules.pagos import service

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
        return service.registrar_pago_cuota(db, cuota_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---- Matrícula ----
@router.post("/matricula/pagar", response_model=PagoOut)
def pagar_matricula(data: RegistrarPagoMatriculaIn, db: Session = Depends(get_db)):
    try:
        return service.registrar_pago_matricula(db, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---- Listado general de pagos ----
@router.get("", response_model=list[PagoOut])
def listar_pagos(db: Session = Depends(get_db)):
    return db.scalars(select(Pago).order_by(Pago.fecha_pago.desc())).all()


@router.post("/marcar-vencidas")
def marcar_vencidas(db: Session = Depends(get_db)):
    n = service.marcar_cuotas_vencidas(db)
    return {"cuotas_marcadas_vencidas": n}
