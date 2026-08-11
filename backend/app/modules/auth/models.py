from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Usuario(Base):
    """
    Usuario del sistema. `rol` NO restringe qué puede hacer (ambos roles
    tienen control completo sobre alumnos, cursos, pagos, etc. -- ver
    app/main.py, todos los routers de negocio solo piden estar logueado).
    Lo único que cambia según el rol es CUÁNTO DETALLE se muestra cuando
    algo sale mal:
      - "admin": mensajes técnicos completos (para poder debuggear).
      - "cliente": mensajes genéricos pensados para alguien sin
        conocimientos técnicos (ver los exception_handlers de app/main.py).
    Además, crear nuevos usuarios (POST /api/auth/usuarios) está
    restringido a rol "admin".
    """
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), default="admin", server_default="admin")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
