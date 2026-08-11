import calendar
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timezone import hoy as hoy_local
from app.modules.gastos.models import Gasto

# Mismo horizonte que se usa al crear un gasto recurrente (11 meses hacia
# adelante = 1 año total contando el mes de alta).
MESES_HORIZONTE = 11


def sumar_meses(fecha_origen: date, cantidad_meses: int) -> date:
    mes = fecha_origen.month - 1 + cantidad_meses
    anio = fecha_origen.year + (mes // 12)
    mes = (mes % 12) + 1
    dia = min(fecha_origen.day, calendar.monthrange(anio, mes)[1])
    return date(anio, mes, dia)


def extender_recurrentes(db: Session) -> int:
    """
    Job idempotente: por cada gasto recurrente "padre", si la última fila
    proyectada (él mismo o su último hijo) queda a menos de MESES_HORIZONTE
    de hoy, genera filas nuevas hasta volver a cubrir ese horizonte.

    Sin esto, un gasto recurrente creado hoy dejaba de generarse solo pasado
    el año (la proyección original de crear_gasto() es fija, de una sola
    vez). Pensado para correr como tarea diaria (ver app/core/scheduler.py).
    """
    horizonte = sumar_meses(hoy_local(), MESES_HORIZONTE)

    padres = db.scalars(
        select(Gasto).where(Gasto.recurrente.is_(True), Gasto.gasto_padre_id.is_(None))
    ).all()

    creados = 0
    for padre in padres:
        ultimo = db.scalar(
            select(Gasto)
            .where((Gasto.id == padre.id) | (Gasto.gasto_padre_id == padre.id))
            .order_by(Gasto.fecha.desc())
            .limit(1)
        )
        if ultimo is None or ultimo.fecha >= horizonte:
            continue

        fecha_cursor = ultimo.fecha
        while fecha_cursor < horizonte:
            fecha_cursor = sumar_meses(fecha_cursor, 1)
            db.add(Gasto(
                categoria=ultimo.categoria,
                descripcion=ultimo.descripcion,
                monto=ultimo.monto,
                fecha=fecha_cursor,
                recurrente=True,
                gasto_padre_id=padre.id,
            ))
            creados += 1

    if creados:
        db.commit()
    return creados
