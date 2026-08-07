from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class MetodoPagoCreate(BaseModel):
    nombre: str
    recargo_pct: Decimal = Decimal("0")
    cuotas_max: int | None = None


class MetodoPagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    recargo_pct: Decimal
    cuotas_max: int | None = None


class CuotaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    inscripcion_id: int
    numero_cuota: int
    fecha_vencimiento: date
    valor_original: Decimal
    valor_actualizado: Decimal
    estado: str


class RegistrarPagoCuotaIn(BaseModel):
    metodo_pago_id: int
    comprobante_nro: str | None = None


class RegistrarPagoMatriculaIn(BaseModel):
    inscripcion_id: int
    metodo_pago_id: int
    comprobante_nro: str | None = None


class PagoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cuota_id: int | None = None
    inscripcion_id: int | None = None
    metodo_pago_id: int
    valor_base: Decimal
    recargo_aplicado: Decimal
    valor_total: Decimal
    fecha_pago: datetime
    comprobante_nro: str | None = None
    tipo: str
    comprobante_id: int | None = None
