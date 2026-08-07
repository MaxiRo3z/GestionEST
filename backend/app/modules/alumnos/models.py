from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, ForeignKey, Numeric, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Alumno(Base):
    __tablename__ = "alumnos"

    id: Mapped[int] = mapped_column(primary_key=True)
    dni: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    apellido: Mapped[str] = mapped_column(String(150), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    activo = mapped_column(Boolean, default=True)
    
    inscripciones: Mapped[list["Inscripcion"]] = relationship(back_populates="alumno")


class Inscripcion(Base):
    __tablename__ = "inscripciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    alumno_id: Mapped[int] = mapped_column(ForeignKey("alumnos.id"))
    curso_id: Mapped[int] = mapped_column(ForeignKey("cursos.id"))
    fecha_inscripcion: Mapped[date] = mapped_column(Date, default=date.today)
    matricula_pagada: Mapped[bool] = mapped_column(Boolean, default=False)
    valor_matricula_congelado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="activa")  # activa/baja/finalizada

    alumno: Mapped["Alumno"] = relationship(back_populates="inscripciones")
    curso: Mapped["Curso"] = relationship(back_populates="inscripciones")
    cuotas: Mapped[list["Cuota"]] = relationship(back_populates="inscripcion", order_by="Cuota.numero_cuota")
    asistencias: Mapped[list["AsistenciaAlumno"]] = relationship(back_populates="inscripcion")
