"""Cálculo de recargos por método de pago (lógica financiera pura, sin DB)."""
from decimal import Decimal

from app.modules.pagos.models import MetodoPago
from app.modules.pagos.service import _calcular_recargo


def test_sin_recargo_efectivo():
    metodo = MetodoPago(nombre="Efectivo", recargo_pct=Decimal("0"))
    recargo, total = _calcular_recargo(Decimal("1000.00"), metodo)
    assert recargo == Decimal("0.00")
    assert total == Decimal("1000.00")


def test_recargo_credito_15_por_ciento():
    metodo = MetodoPago(nombre="Tarjeta de Crédito", recargo_pct=Decimal("15"))
    recargo, total = _calcular_recargo(Decimal("1000.00"), metodo)
    assert recargo == Decimal("150.00")
    assert total == Decimal("1150.00")


def test_recargo_redondea_a_dos_decimales():
    # 333.33 * 12.5% = 41.66625 -> redondeado a 41.67 (ROUND_HALF_UP)
    metodo = MetodoPago(nombre="Débito", recargo_pct=Decimal("12.5"))
    recargo, total = _calcular_recargo(Decimal("333.33"), metodo)
    assert recargo == Decimal("41.67")
    assert total == Decimal("375.00")
