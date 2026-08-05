from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.modules.gastos.models import Gasto
from app.modules.gastos.schemas import GastoCreate, GastoOut
from app.modules.pagos.models import Pago

router = APIRouter(prefix="/api/gastos", tags=["Gastos y Caja"])


@router.get("", response_model=list[GastoOut])
def listar_gastos(db: Session = Depends(get_db)):
    return db.scalars(select(Gasto).order_by(Gasto.fecha.desc())).all()


@router.post("", response_model=GastoOut, status_code=201)
def crear_gasto(data: GastoCreate, db: Session = Depends(get_db)):
    gasto = Gasto(**data.model_dump())
    db.add(gasto)
    db.commit()
    db.refresh(gasto)
    return gasto


@router.get("/balance")
def balance_mensual(anio: int, mes: int, db: Session = Depends(get_db)):
    """Balance simple: ingresos (pagos del mes) vs egresos (gastos del mes)."""
    inicio = date(anio, mes, 1)
    fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)

    ingresos = db.scalar(
        select(func.coalesce(func.sum(Pago.valor_total), 0)).where(
            Pago.fecha_pago >= inicio, Pago.fecha_pago < fin
        )
    )
    egresos = db.scalar(
        select(func.coalesce(func.sum(Gasto.monto), 0)).where(
            Gasto.fecha >= inicio, Gasto.fecha < fin
        )
    )
    ingresos = Decimal(ingresos or 0)
    egresos = Decimal(egresos or 0)
    return {
        "periodo": f"{anio}-{mes:02d}",
        "ingresos": ingresos,
        "egresos": egresos,
        "resultado": ingresos - egresos,
    }
