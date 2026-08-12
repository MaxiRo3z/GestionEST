from datetime import date
from pydantic import BaseModel, ConfigDict


class AsistenciaAlumnoCreate(BaseModel):
    inscripcion_id: int
    fecha: date
    presente: bool
    justificada: bool = False


class AsistenciaAlumnoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    inscripcion_id: int
    fecha: date
    presente: bool
    justificada: bool
