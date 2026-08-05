from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.modules.cursos.models import Curso
from app.modules.cursos.schemas import CursoCreate, CursoOut, AjusteArancelIn
from app.modules.cursos import service

router = APIRouter(prefix="/api/cursos", tags=["Cursos"])


@router.get("", response_model=list[CursoOut])
def listar_cursos(db: Session = Depends(get_db)):
    cursos = db.scalars(select(Curso).order_by(Curso.nombre)).all()
    return cursos


@router.post("", response_model=CursoOut, status_code=201)
def crear_curso(data: CursoCreate, db: Session = Depends(get_db)):
    return service.crear_curso(db, data)


@router.get("/{curso_id}", response_model=CursoOut)
def obtener_curso(curso_id: int, db: Session = Depends(get_db)):
    curso = db.get(Curso, curso_id)
    if not curso:
        raise HTTPException(404, "Curso no encontrado")
    return curso


@router.post("/{curso_id}/ajustar-arancel")
def ajustar_arancel(curso_id: int, data: AjusteArancelIn, db: Session = Depends(get_db)):
    try:
        return service.aplicar_ajuste_arancel(db, curso_id, data)
    except ValueError as e:
        raise HTTPException(404, str(e))
