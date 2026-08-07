from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class AlumnoCreate(BaseModel):
    dni: str
    nombre: str
    apellido: str
    telefono: str | None = None
    email: str | None = None

class AlumnoUpdate(BaseModel):
    dni: str
    nombre: str
    apellido: str
    telefono: str | None = None
    email: str | None = None
    
class AlumnoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    dni: str
    nombre: str
    apellido: str
    telefono: str | None = None
    email: str | None = None
    activo: bool = True


class InscripcionCreate(BaseModel):
    alumno_id: int
    curso_id: int
    dia_vencimiento: int = 10  # día del mes en que vence cada cuota


class InscripcionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    alumno_id: int
    curso_id: int
    fecha_inscripcion: date
    matricula_pagada: bool
    valor_matricula_congelado: Decimal
    estado: str
