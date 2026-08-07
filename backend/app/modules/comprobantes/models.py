from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

class Comprobante(Base):
    __tablename__ = "comprobantes"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False) # 'matricula', 'cuota', 'liquidacion'
    referencia_id: Mapped[int] = mapped_column(Integer, nullable=False) # ID de la cuota, inscripcion o liquidacion
    alumno_id: Mapped[int | None] = mapped_column(ForeignKey("alumnos.id"), nullable=True)
    profesor_id: Mapped[int | None] = mapped_column(ForeignKey("profesores.id"), nullable=True)
    numero_comprobante: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
