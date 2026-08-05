"""
Importa TODOS los modelos de TODOS los módulos en un solo lugar.

Por qué existe este archivo: SQLAlchemy resuelve relationships() que están
declaradas como strings (ej. Mapped["Curso"]) recién cuando se "configuran"
los mappers, y para eso necesita que la clase ya haya sido importada al
menos una vez en el proceso. Como los módulos son independientes entre sí
(cursos no importa alumnos, alumnos no importa pagos, etc. -> evitamos
imports circulares), centralizamos la carga acá.

Tanto Alembic (env.py) como main.py importan este archivo antes de tocar
la base de datos.
"""
from app.db.session import Base  # noqa: F401

from app.modules.cursos.models import Curso, CursoPrecio  # noqa: F401
from app.modules.alumnos.models import Alumno, Inscripcion  # noqa: F401
from app.modules.pagos.models import Cuota, AjustePrecio, MetodoPago, Pago  # noqa: F401
from app.modules.profesores.models import Profesor, AsistenciaProfesor, Liquidacion  # noqa: F401
from app.modules.asistencias.models import AsistenciaAlumno  # noqa: F401
from app.modules.gastos.models import Gasto  # noqa: F401
