from datetime import date
from sqlalchemy import Boolean, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class AsistenciaAlumno(Base):
    __tablename__ = "asistencias_alumnos"
    __table_args__ = (UniqueConstraint("inscripcion_id", "fecha", name="uq_inscripcion_fecha"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    inscripcion_id: Mapped[int] = mapped_column(ForeignKey("inscripciones.id"))
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    presente: Mapped[bool] = mapped_column(Boolean, nullable=False)

    inscripcion: Mapped["Inscripcion"] = relationship(back_populates="asistencias")
