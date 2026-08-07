import calendar
from datetime import date

from sqlalchemy.orm import Session
from sqlalchemy import select  # NUEVO: Importamos select para la consulta

from app.modules.alumnos.models import Alumno, Inscripcion
from app.modules.alumnos.schemas import AlumnoCreate, InscripcionCreate
from app.modules.cursos.models import Curso
from app.modules.pagos.models import Cuota


def _sumar_meses(d: date, n: int) -> date:
    """Suma n meses a una fecha, ajustando el día si el mes destino es más corto
    (evita el clásico bug de '31 de febrero'). Sin dependencias externas."""
    mes_total = d.month - 1 + n
    anio = d.year + mes_total // 12
    mes = mes_total % 12 + 1
    dia = min(d.day, calendar.monthrange(anio, mes)[1])
    return date(anio, mes, dia)


def crear_alumno(db: Session, data: AlumnoCreate) -> Alumno:
    alumno = Alumno(**data.model_dump())
    db.add(alumno)
    db.commit()
    db.refresh(alumno)
    return alumno


def crear_inscripcion(db: Session, data: InscripcionCreate) -> Inscripcion:
    """
    Inscribe a un alumno en un curso:
    1. Valida que no esté inscripto previamente (salvo que ya haya finalizado).
    2. Congela el valor de matrícula vigente al momento de inscribirse.
    3. Genera el plan completo de cuotas (según duracion_meses del curso),
       cada una con el valor de cuota vigente en ese momento (congelado
       también, aunque puede actualizarse después vía ajuste de arancel
       mientras esté pendiente).
    """
    
    # --- NUEVA LÓGICA: Validar duplicidad ---
    inscripcion_existente = db.scalar(
        select(Inscripcion).where(
            Inscripcion.alumno_id == data.alumno_id,
            Inscripcion.curso_id == data.curso_id,
            Inscripcion.estado != "finalizada"
        )
    )
    if inscripcion_existente:
        raise ValueError("El alumno ya se encuentra registrado en este curso. Solo puede reinscribirse si el periodo finalizó.")
    # ----------------------------------------

    curso = db.get(Curso, data.curso_id)
    if not curso:
        raise ValueError("Curso no encontrado")
    precio = curso.precio_vigente
    if not precio:
        raise ValueError("El curso no tiene un precio configurado todavía")

    inscripcion = Inscripcion(
        alumno_id=data.alumno_id,
        curso_id=data.curso_id,
        valor_matricula_congelado=precio.valor_matricula,
    )
    db.add(inscripcion)
    db.flush()

    hoy = date.today()
    primer_vencimiento = date(hoy.year, hoy.month, min(data.dia_vencimiento, 28))
    if primer_vencimiento <= hoy:
        primer_vencimiento = _sumar_meses(primer_vencimiento, 1)

    for n in range(curso.duracion_meses):
        vencimiento = _sumar_meses(primer_vencimiento, n)
        cuota = Cuota(
            inscripcion_id=inscripcion.id,
            numero_cuota=n + 1,
            fecha_vencimiento=vencimiento,
            valor_original=precio.valor_cuota,
            valor_actualizado=precio.valor_cuota,
        )
        db.add(cuota)

    db.commit()
    db.refresh(inscripcion)
    return inscripcion