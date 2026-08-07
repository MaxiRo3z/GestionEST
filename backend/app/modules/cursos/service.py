from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.cursos.models import Curso, CursoPrecio
from app.modules.pagos.models import Cuota, AjustePrecio
from app.modules.cursos.schemas import CursoCreate, AjusteArancelIn


def crear_curso(db: Session, data: CursoCreate) -> Curso:
    curso = Curso(nombre=data.nombre, duracion_meses=data.duracion_meses)
    db.add(curso)
    db.flush()  # para tener curso.id sin cerrar la transacción

    precio_inicial = CursoPrecio(
        curso_id=curso.id,
        valor_matricula=data.valor_matricula,
        valor_cuota=data.valor_cuota,
        motivo="Precio inicial",
    )
    db.add(precio_inicial)
    db.commit()
    db.refresh(curso)
    return curso


def aplicar_ajuste_arancel(db: Session, curso_id: int, data: AjusteArancelIn) -> dict:
    """
    Aplica un aumento de arancel a un curso:
    1. Inserta un nuevo CursoPrecio vigente.
    2. Actualiza valor_actualizado de TODAS las cuotas PENDIENTES.
    3. (NUEVO) Actualiza valor_matricula_congelado de las inscripciones 
       cuya matricula_pagada == False.
    """
    curso = db.get(Curso, curso_id)
    if not curso:
        raise ValueError("Curso no encontrado")

    precio_actual = curso.precio_vigente
    valor_matricula_nuevo = data.nuevo_valor_matricula or (
        precio_actual.valor_matricula if precio_actual else data.nuevo_valor_cuota
    )

    nuevo_precio = CursoPrecio(
        curso_id=curso.id,
        valor_matricula=valor_matricula_nuevo,
        valor_cuota=data.nuevo_valor_cuota,
        motivo=data.motivo,
    )
    db.add(nuevo_precio)

    # 1. Actualizar cuotas pendientes
    cuotas_pendientes = db.scalars(
        select(Cuota)
        .join(Cuota.inscripcion)
        .where(Cuota.estado.in_(["pendiente", "vencida"]))
    ).all()

    cuotas_tocadas = 0
    for cuota in cuotas_pendientes:
        if cuota.inscripcion.curso_id != curso.id:
            continue
        if cuota.valor_actualizado == data.nuevo_valor_cuota:
            continue
        ajuste = AjustePrecio(
            curso_id=curso.id,
            cuota_id=cuota.id,
            valor_anterior=cuota.valor_actualizado,
            valor_nuevo=data.nuevo_valor_cuota,
            motivo=data.motivo,
        )
        cuota.valor_actualizado = data.nuevo_valor_cuota
        db.add(ajuste)
        cuotas_tocadas += 1

    # 2. NUEVO: Actualizar matrículas impagas de ese curso
    from app.modules.alumnos.models import Inscripcion # Importación local para evitar ciclos
    inscripciones_sin_pagar = db.scalars(
        select(Inscripcion).where(
            Inscripcion.curso_id == curso.id,
            Inscripcion.matricula_pagada == False,
            Inscripcion.estado == "activa"
        )
    ).all()
    
    matriculas_tocadas = 0
    for inscripcion in inscripciones_sin_pagar:
        if inscripcion.valor_matricula_congelado != valor_matricula_nuevo:
            inscripcion.valor_matricula_congelado = valor_matricula_nuevo
            matriculas_tocadas += 1

    db.commit()
    return {
        "curso_id": curso.id, 
        "nuevo_precio_id": nuevo_precio.id, 
        "cuotas_actualizadas": cuotas_tocadas,
        "matriculas_actualizadas": matriculas_tocadas
    }
