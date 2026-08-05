from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Integer, Date, DateTime, Numeric, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Cuota(Base):
    """
    Cada cuota es un registro congelado en el momento de su generación.
    valor_original NUNCA cambia (auditoría / lo que se planificó).
    valor_actualizado es lo que hay que cobrar HOY (puede subir por ajustes,
    pero solo mientras esté pendiente; una vez pagada, no se toca más).
    """
    __tablename__ = "cuotas"
    __table_args__ = (UniqueConstraint("inscripcion_id", "numero_cuota", name="uq_inscripcion_numero"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    inscripcion_id: Mapped[int] = mapped_column(ForeignKey("inscripciones.id"))
    numero_cuota: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_vencimiento: Mapped[date] = mapped_column(Date, nullable=False)
    valor_original: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    valor_actualizado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="pendiente")  # pendiente/pagada/vencida

    inscripcion: Mapped["Inscripcion"] = relationship(back_populates="cuotas")
    pagos: Mapped[list["Pago"]] = relationship(back_populates="cuota")
    ajustes: Mapped[list["AjustePrecio"]] = relationship(back_populates="cuota")


class AjustePrecio(Base):
    """Log de auditoría: cada aumento aplicado a una cuota pendiente queda
    registrado acá. Nunca se sobreescribe ni se borra."""
    __tablename__ = "ajustes_precio"

    id: Mapped[int] = mapped_column(primary_key=True)
    curso_id: Mapped[int] = mapped_column(ForeignKey("cursos.id"))
    cuota_id: Mapped[int] = mapped_column(ForeignKey("cuotas.id"))
    valor_anterior: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    valor_nuevo: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    aplicado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    motivo: Mapped[str | None] = mapped_column(String(200), nullable=True)

    cuota: Mapped["Cuota"] = relationship(back_populates="ajustes")


class MetodoPago(Base):
    __tablename__ = "metodos_pago"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), nullable=False)  # efectivo/transferencia/debito/credito
    recargo_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    cuotas_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    pagos: Mapped[list["Pago"]] = relationship(back_populates="metodo_pago")


class Pago(Base):
    __tablename__ = "pagos"

    id: Mapped[int] = mapped_column(primary_key=True)
    cuota_id: Mapped[int | None] = mapped_column(ForeignKey("cuotas.id"), nullable=True)
    inscripcion_id: Mapped[int | None] = mapped_column(ForeignKey("inscripciones.id"), nullable=True)
    metodo_pago_id: Mapped[int] = mapped_column(ForeignKey("metodos_pago.id"))
    valor_base: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    recargo_aplicado: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    valor_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    fecha_pago: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    comprobante_nro: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tipo: Mapped[str] = mapped_column(String(20), default="cuota")  # cuota | matricula

    cuota: Mapped["Cuota | None"] = relationship(back_populates="pagos")
    metodo_pago: Mapped["MetodoPago"] = relationship(back_populates="pagos")
