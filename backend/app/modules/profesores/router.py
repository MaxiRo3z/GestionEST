from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.modules.profesores.models import Profesor, AsistenciaProfesor, Liquidacion
from app.modules.profesores.schemas import (
    ProfesorCreate, ProfesorOut, AsistenciaProfesorCreate, AsistenciaProfesorOut,
    GenerarLiquidacionIn, LiquidacionOut,LiquidacionUpdate
)
from app.modules.profesores import service

router = APIRouter(prefix="/api/profesores", tags=["Profesores"])


@router.get("", response_model=list[ProfesorOut])
def listar_profesores(db: Session = Depends(get_db)):
    return db.scalars(select(Profesor)).all()


@router.post("", response_model=ProfesorOut, status_code=201)
def crear_profesor(data: ProfesorCreate, db: Session = Depends(get_db)):
    profesor = Profesor(**data.model_dump())
    db.add(profesor)
    db.commit()
    db.refresh(profesor)
    return profesor


@router.post("/asistencias", response_model=AsistenciaProfesorOut, status_code=201)
def cargar_asistencia(data: AsistenciaProfesorCreate, db: Session = Depends(get_db)):
    asistencia = AsistenciaProfesor(**data.model_dump())
    db.add(asistencia)
    db.commit()
    db.refresh(asistencia)
    return asistencia


@router.get("/asistencias", response_model=list[AsistenciaProfesorOut])
def listar_asistencias(profesor_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(AsistenciaProfesor)
    if profesor_id:
        stmt = stmt.where(AsistenciaProfesor.profesor_id == profesor_id)
    return db.scalars(stmt.order_by(AsistenciaProfesor.fecha.desc())).all()


@router.post("/liquidaciones/generar", response_model=LiquidacionOut)
def generar_liquidacion(data: GenerarLiquidacionIn, db: Session = Depends(get_db)):
    try:
        return service.generar_liquidacion(db, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/liquidaciones", response_model=list[LiquidacionOut])
def listar_liquidaciones(profesor_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(Liquidacion)
    if profesor_id:
        stmt = stmt.where(Liquidacion.profesor_id == profesor_id)
    return db.scalars(stmt.order_by(Liquidacion.periodo.desc())).all()


@router.post("/liquidaciones/{liquidacion_id}/marcar-pagada", response_model=LiquidacionOut)
def marcar_pagada(liquidacion_id: int, db: Session = Depends(get_db)):
    try:
        return service.marcar_liquidacion_pagada(db, liquidacion_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.put("/liquidaciones/{liquidacion_id}", response_model=LiquidacionOut)
def editar_liquidacion(liquidacion_id: int, data: LiquidacionUpdate, db: Session = Depends(get_db)):
    liq = db.get(Liquidacion, liquidacion_id)
    if not liq:
        raise HTTPException(404, "Liquidación no encontrada")
    
    if liq.pagado:
        raise HTTPException(status_code=400, detail="No se puede modificar una liquidación que ya ha sido pagada.")

    # Obtenemos al profesor para saber cuál es su valor por hora actual
    profesor = db.get(Profesor, liq.profesor_id)
    if not profesor:
        raise HTTPException(404, "Profesor no encontrado")

    # Actualizamos las horas y los descuentos
    liq.horas_totales = data.horas_totales
    liq.descuentos = data.descuentos
    
    # Recalculamos la plata automáticamente: Horas * Valor Hora
    liq.valor_bruto = liq.horas_totales * profesor.valor_hora
    liq.valor_neto = liq.valor_bruto - liq.descuentos
    
    db.commit()
    db.refresh(liq)
    return liq