from datetime import date
from decimal import Decimal
from sqlalchemy import String, Boolean, Date, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Profesor(Base):
    __tablename__ = "profesores"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    dni: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    valor_hora: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    asistencias: Mapped[list["AsistenciaProfesor"]] = relationship(back_populates="profesor")
    liquidaciones: Mapped[list["Liquidacion"]] = relationship(back_populates="profesor")


class AsistenciaProfesor(Base):
    __tablename__ = "asistencias_profesores"

    id: Mapped[int] = mapped_column(primary_key=True)
    profesor_id: Mapped[int] = mapped_column(ForeignKey("profesores.id"))
    curso_id: Mapped[int] = mapped_column(ForeignKey("cursos.id"))
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    horas_asignadas: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    horas_trabajadas: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    observacion: Mapped[str | None] = mapped_column(String(200), nullable=True)

    profesor: Mapped["Profesor"] = relationship(back_populates="asistencias")


class Liquidacion(Base):
    __tablename__ = "liquidaciones"
    __table_args__ = (UniqueConstraint("profesor_id", "periodo", name="uq_profesor_periodo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    profesor_id: Mapped[int] = mapped_column(ForeignKey("profesores.id"))
    periodo: Mapped[date] = mapped_column(Date, nullable=False)  # primer día del mes
    horas_totales: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    valor_bruto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    descuentos: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    valor_neto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    pagado: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_pago: Mapped[date | None] = mapped_column(Date, nullable=True)

    profesor: Mapped["Profesor"] = relationship(back_populates="liquidaciones")
