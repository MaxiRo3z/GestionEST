from datetime import datetime, date
from sqlalchemy import String, Integer, Boolean, ForeignKey, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal

from app.db.session import Base


class Curso(Base):
    __tablename__ = "cursos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    duracion_meses: Mapped[int] = mapped_column(Integer, default=12)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    precios: Mapped[list["CursoPrecio"]] = relationship(back_populates="curso", order_by="CursoPrecio.vigente_desde.desc()")
    inscripciones: Mapped[list["Inscripcion"]] = relationship(back_populates="curso")

    @property
    def precio_vigente(self) -> "CursoPrecio | None":
        return self.precios[0] if self.precios else None


class CursoPrecio(Base):
    """
    Histórico de precios de un curso. NUNCA se hace UPDATE sobre un registro
    existente: cada aumento inserta una fila nueva con vigente_desde=now().
    El precio "actual" siempre es el de vigente_desde más reciente.
    """
    __tablename__ = "curso_precios"

    id: Mapped[int] = mapped_column(primary_key=True)
    curso_id: Mapped[int] = mapped_column(ForeignKey("cursos.id"))
    valor_matricula: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    valor_cuota: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    vigente_desde: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    motivo: Mapped[str | None] = mapped_column(String(200), nullable=True)

    curso: Mapped["Curso"] = relationship(back_populates="precios")
