from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class CursoPrecioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    valor_matricula: Decimal
    valor_cuota: Decimal
    vigente_desde: datetime
    motivo: str | None = None


class CursoCreate(BaseModel):
    nombre: str
    duracion_meses: int = 12
    valor_matricula: Decimal
    valor_cuota: Decimal


class CursoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    duracion_meses: int
    activo: bool
    precio_vigente: CursoPrecioOut | None = None


class AjusteArancelIn(BaseModel):
    nuevo_valor_cuota: Decimal
    motivo: str = "Ajuste inflacionario"
    nuevo_valor_matricula: Decimal | None = None
