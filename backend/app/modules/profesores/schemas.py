from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ProfesorCreate(BaseModel):
    nombre: str
    dni: str | None = None
    valor_hora: Decimal


class ProfesorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    dni: str | None = None
    valor_hora: Decimal
    activo: bool


class AsistenciaProfesorCreate(BaseModel):
    profesor_id: int
    curso_id: int
    fecha: date
    horas_asignadas: Decimal
    horas_trabajadas: Decimal
    observacion: str | None = None


class AsistenciaProfesorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    profesor_id: int
    curso_id: int
    fecha: date
    horas_asignadas: Decimal
    horas_trabajadas: Decimal
    observacion: str | None = None


class GenerarLiquidacionIn(BaseModel):
    profesor_id: int
    periodo: date  # cualquier día del mes a liquidar; se normaliza al día 1


class LiquidacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    profesor_id: int
    periodo: date
    horas_totales: Decimal
    valor_bruto: Decimal
    descuentos: Decimal
    valor_neto: Decimal
    pagado: bool
    fecha_pago: date | None = None

class LiquidacionUpdate(BaseModel):
    horas_totales: Decimal
    descuentos: Decimal