from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.modules.pagos.models import Cuota, Pago, MetodoPago
from app.modules.alumnos.models import Inscripcion
from app.modules.pagos.schemas import RegistrarPagoCuotaIn, RegistrarPagoMatriculaIn
from app.events.bus import event_bus


def _redondear(valor: Decimal) -> Decimal:
    return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _calcular_recargo(valor_base: Decimal, metodo: MetodoPago) -> tuple[Decimal, Decimal]:
    """Devuelve (recargo_aplicado, valor_total) según el % configurado en el
    método de pago (ej. tarjeta de crédito con financiamiento en N cuotas)."""
    recargo = _redondear(valor_base * (metodo.recargo_pct / Decimal("100")))
    total = _redondear(valor_base + recargo)
    return recargo, total


def registrar_pago_cuota(db: Session, cuota_id: int, data: RegistrarPagoCuotaIn) -> Pago:
    cuota = db.get(Cuota, cuota_id)
    if not cuota:
        raise ValueError("Cuota no encontrada")
    if cuota.estado == "pagada":
        raise ValueError("Esta cuota ya está pagada")

    metodo = db.get(MetodoPago, data.metodo_pago_id)
    if not metodo:
        raise ValueError("Método de pago no encontrado")

    recargo, total = _calcular_recargo(cuota.valor_actualizado, metodo)

    pago = Pago(
        cuota_id=cuota.id,
        metodo_pago_id=metodo.id,
        valor_base=cuota.valor_actualizado,
        recargo_aplicado=recargo,
        valor_total=total,
        comprobante_nro=data.comprobante_nro,
        tipo="cuota",
    )
    cuota.estado = "pagada"
    db.add(pago)
    db.commit()
    db.refresh(pago)

    event_bus.emit("pago.registrado", {
        "pago_id": pago.id, "tipo": "cuota", "cuota_id": cuota.id,
        "inscripcion_id": cuota.inscripcion_id, "valor_total": str(total),
    })
    return pago


def registrar_pago_matricula(db: Session, data: RegistrarPagoMatriculaIn) -> Pago:
    inscripcion = db.get(Inscripcion, data.inscripcion_id)
    if not inscripcion:
        raise ValueError("Inscripción no encontrada")
    if inscripcion.matricula_pagada:
        raise ValueError("La matrícula de esta inscripción ya está pagada")

    metodo = db.get(MetodoPago, data.metodo_pago_id)
    if not metodo:
        raise ValueError("Método de pago no encontrado")

    recargo, total = _calcular_recargo(inscripcion.valor_matricula_congelado, metodo)

    pago = Pago(
        inscripcion_id=inscripcion.id,
        metodo_pago_id=metodo.id,
        valor_base=inscripcion.valor_matricula_congelado,
        recargo_aplicado=recargo,
        valor_total=total,
        comprobante_nro=data.comprobante_nro,
        tipo="matricula",
    )
    inscripcion.matricula_pagada = True
    db.add(pago)
    db.commit()
    db.refresh(pago)

    event_bus.emit("pago.registrado", {
        "pago_id": pago.id, "tipo": "matricula", "inscripcion_id": inscripcion.id,
        "valor_total": str(total),
    })
    return pago


def marcar_cuotas_vencidas(db: Session) -> int:
    """Job idempotente: pasa a estado 'vencida' toda cuota pendiente cuya
    fecha_vencimiento ya pasó. Pensado para correr como tarea diaria."""
    from datetime import date
    from sqlalchemy import select

    cuotas = db.scalars(
        select(Cuota).where(Cuota.estado == "pendiente", Cuota.fecha_vencimiento < date.today())
    ).all()
    for cuota in cuotas:
        cuota.estado = "vencida"
        event_bus.emit("cuota.vencida", {"cuota_id": cuota.id, "inscripcion_id": cuota.inscripcion_id})
    db.commit()
    return len(cuotas)
