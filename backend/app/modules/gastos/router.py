from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.session import get_db
from app.modules.gastos.models import Gasto
from app.modules.gastos.schemas import GastoCreate, GastoOut
from app.modules.gastos.service import sumar_meses
from app.modules.pagos.models import Pago

router = APIRouter(prefix="/api/gastos", tags=["Gastos y Caja"])


@router.get("", response_model=list[GastoOut])
def listar_gastos(anio: int, mes: int, db: Session = Depends(get_db)):
    """Muestra solamente los gastos registrados por cada mes específico."""
    inicio = date(anio, mes, 1)
    fin = date(anio + 1, 1, 1) if mes == 12 else date(anio, mes + 1, 1)

    return db.scalars(
        select(Gasto)
        .where(Gasto.fecha >= inicio, Gasto.fecha < fin)
        .order_by(Gasto.fecha.desc())
    ).all()


@router.post("", response_model=GastoOut, status_code=201)
def crear_gasto(data: GastoCreate, db: Session = Depends(get_db)):
    """Crea un gasto. Si es recurrente, proyecta el gasto para los próximos 11 meses (1 año total)."""
    gasto = Gasto(**data.model_dump())
    db.add(gasto)
    db.commit()
    db.refresh(gasto)

    if gasto.recurrente:
        # Generamos los gastos para los próximos 11 meses automáticamente
        for i in range(1, 12):
            fecha_futura = sumar_meses(gasto.fecha, i)
            gasto_futuro = Gasto(
                categoria=gasto.categoria,
                descripcion=gasto.descripcion,
                monto=gasto.monto,
                fecha=fecha_futura,
                recurrente=True,
                gasto_padre_id=gasto.id # Enlazamos al original
            )
            db.add(gasto_futuro)
        db.commit()

    return gasto


@router.put("/{gasto_id}", response_model=GastoOut)
def modificar_gasto(gasto_id: int, data: GastoCreate, db: Session = Depends(get_db)):
    """Modifica un gasto. Si es recurrente, aplica los cambios de monto/descripción a los meses futuros."""
    gasto = db.scalar(select(Gasto).where(Gasto.id == gasto_id))
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    # Actualizamos el gasto actual
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(gasto, key, value)
    
    db.commit()
    db.refresh(gasto)

    # Si es un gasto recurrente (o hijo de uno), modificamos los futuros
    if gasto.recurrente:
        id_padre = gasto.gasto_padre_id if gasto.gasto_padre_id else gasto.id
        
        gastos_futuros = db.scalars(
            select(Gasto).where(
                (Gasto.gasto_padre_id == id_padre) & 
                (Gasto.fecha > gasto.fecha)
            )
        ).all()

        for gf in gastos_futuros:
            gf.monto = gasto.monto
            gf.descripcion = gasto.descripcion
            gf.categoria = gasto.categoria
            # No cambiamos la fecha de los futuros, solo sus valores

        db.commit()

    return gasto


@router.delete("/{gasto_id}", status_code=204)
def eliminar_gasto(gasto_id: int, db: Session = Depends(get_db)):
    """Elimina un gasto. Si es recurrente, borra todos los de fechas posteriores."""
    gasto = db.scalar(select(Gasto).where(Gasto.id == gasto_id))
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    if gasto.recurrente:
        id_padre = gasto.gasto_padre_id if gasto.gasto_padre_id else gasto.id
        
        # Eliminamos todos los hijos futuros vinculados a este gasto
        db.execute(
            Gasto.__table__.delete().where(
                (Gasto.gasto_padre_id == id_padre) & 
                (Gasto.fecha > gasto.fecha)
            )
        )
    
    # Finalmente eliminamos el gasto seleccionado
    db.delete(gasto)
    db.commit()


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
