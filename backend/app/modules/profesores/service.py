from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.profesores.models import Profesor, AsistenciaProfesor, Liquidacion
from app.modules.profesores.schemas import GenerarLiquidacionIn
from app.events.bus import event_bus


def _redondear(valor: Decimal) -> Decimal:
    return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def generar_liquidacion(db: Session, data: GenerarLiquidacionIn) -> Liquidacion:
    """
    Calcula la liquidación mensual de un profesor:
    - Suma horas_trabajadas (no asignadas) de todas las asistencias del mes.
    - valor_bruto = horas_trabajadas * valor_hora del profesor.
    - descuentos = (horas_asignadas - horas_trabajadas) * valor_hora,
      es decir, el valor de las horas NO trabajadas (inasistencias).
    - valor_neto = valor_bruto (ya que valor_bruto se calcula sobre horas
      efectivamente trabajadas; descuentos queda como dato informativo /
      auditable de cuánto se descontó respecto de lo asignado).
    Es idempotente por (profesor_id, periodo): si ya existe, se re-calcula
    sobre el mismo registro en lugar de duplicar.
    """
    profesor = db.get(Profesor, data.profesor_id)
    if not profesor:
        raise ValueError("Profesor no encontrado")

    periodo_normalizado = date(data.periodo.year, data.periodo.month, 1)
    if data.periodo.month == 12:
        siguiente_mes = date(data.periodo.year + 1, 1, 1)
    else:
        siguiente_mes = date(data.periodo.year, data.periodo.month + 1, 1)

    asistencias = db.scalars(
        select(AsistenciaProfesor).where(
            AsistenciaProfesor.profesor_id == profesor.id,
            AsistenciaProfesor.fecha >= periodo_normalizado,
            AsistenciaProfesor.fecha < siguiente_mes,
        )
    ).all()

    horas_asignadas_total = sum((a.horas_asignadas for a in asistencias), Decimal("0"))
    horas_trabajadas_total = sum((a.horas_trabajadas for a in asistencias), Decimal("0"))
    horas_no_trabajadas = horas_asignadas_total - horas_trabajadas_total

    valor_bruto = _redondear(horas_trabajadas_total * profesor.valor_hora)
    descuentos = _redondear(max(horas_no_trabajadas, Decimal("0")) * profesor.valor_hora)
    valor_neto = valor_bruto  # bruto ya refleja solo horas trabajadas

    existente = db.scalar(
        select(Liquidacion).where(
            Liquidacion.profesor_id == profesor.id,
            Liquidacion.periodo == periodo_normalizado,
        )
    )
    if existente:
        if existente.pagado:
            raise ValueError("Esta liquidación ya fue pagada, no se puede recalcular")
        existente.horas_totales = horas_trabajadas_total
        existente.valor_bruto = valor_bruto
        existente.descuentos = descuentos
        existente.valor_neto = valor_neto
        liquidacion = existente
    else:
        liquidacion = Liquidacion(
            profesor_id=profesor.id,
            periodo=periodo_normalizado,
            horas_totales=horas_trabajadas_total,
            valor_bruto=valor_bruto,
            descuentos=descuentos,
            valor_neto=valor_neto,
        )
        db.add(liquidacion)

    db.commit()
    db.refresh(liquidacion)

    event_bus.emit("liquidacion.generada", {
        "liquidacion_id": liquidacion.id, "profesor_id": profesor.id,
        "periodo": str(periodo_normalizado), "valor_neto": str(valor_neto),
    })
    return liquidacion


def marcar_liquidacion_pagada(db: Session, liquidacion_id: int) -> Liquidacion:
    liquidacion = db.get(Liquidacion, liquidacion_id)
    if not liquidacion:
        raise ValueError("Liquidación no encontrada")
    liquidacion.pagado = True
    liquidacion.fecha_pago = date.today()
    db.commit()
    db.refresh(liquidacion)
    return liquidacion
