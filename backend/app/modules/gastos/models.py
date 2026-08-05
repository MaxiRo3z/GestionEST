from datetime import date
from decimal import Decimal
from sqlalchemy import String, Boolean, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Gasto(Base):
    __tablename__ = "gastos"

    id: Mapped[int] = mapped_column(primary_key=True)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False)  # alquiler/servicios/mantenimiento/otro
    descripcion: Mapped[str | None] = mapped_column(String(200), nullable=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    recurrente: Mapped[bool] = mapped_column(Boolean, default=False)
