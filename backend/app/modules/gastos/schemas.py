from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class GastoCreate(BaseModel):
    categoria: str
    descripcion: str | None = None
    monto: Decimal
    fecha: date
    recurrente: bool = False


class GastoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    categoria: str
    descripcion: str | None = None
    monto: Decimal
    fecha: date
    recurrente: bool
