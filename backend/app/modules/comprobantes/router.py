from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.db.session import get_db
from app.modules.comprobantes.models import Comprobante
from app.modules.comprobantes.service import generar_pdf_bytes

from app.modules.pagos.models import Pago, MetodoPago
from app.modules.alumnos.models import Alumno

# --- Esquema para traducir de Base de Datos a React ---
# NOTA: por ahora los comprobantes solo se emiten para alumnos (cuota /
# matrícula). El comprobante de liquidación docente se sacó del alcance:
# los recibos de sueldo no se entregan a los profesores por el momento.
class ComprobanteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tipo: str
    referencia_id: int
    alumno_id: int | None = None
    numero_comprobante: str
    creado_en: datetime

router = APIRouter(prefix="/api/comprobantes", tags=["Comprobantes"])

# --- APLICAMOS EL ESQUEMA A LAS RUTAS ---
@router.get("/alumno/{alumno_id}", response_model=list[ComprobanteOut])
def listar_por_alumno(alumno_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(Comprobante).where(Comprobante.alumno_id == alumno_id).order_by(Comprobante.creado_en.desc())).all()

@router.get("/{comprobante_id}/pdf")
def descargar_pdf(comprobante_id: int, db: Session = Depends(get_db)):
    comp = db.get(Comprobante, comprobante_id)
    if not comp:
        raise HTTPException(404, "Comprobante no encontrado")

    destinatario_nombre = "Consumidor Final"
    concepto_desc = f"Pago de {comp.tipo.capitalize()}"
    metodo_pago_str = "No especificado"
    desglose_items = []
    total_str = "$ 0.00"

    if comp.alumno_id:
        alumno = db.get(Alumno, comp.alumno_id)
        if alumno:
            destinatario_nombre = f"{alumno.nombre} {alumno.apellido} (DNI: {alumno.dni})"

    if comp.tipo in ["cuota", "matricula"]:
        pago = db.get(Pago, comp.referencia_id)
        if pago:
            metodo = db.get(MetodoPago, pago.metodo_pago_id)
            if metodo:
                metodo_pago_str = metodo.nombre

            total_str = f"$ {pago.valor_total:,.2f}"
            desglose_items.append((f"Valor Base ({comp.tipo.capitalize()})", f"$ {pago.valor_base:,.2f}"))

            if pago.recargo_aplicado > 0:
                desglose_items.append(("Recargo por método de pago", f"$ {pago.recargo_aplicado:,.2f}"))

    pdf_buffer = generar_pdf_bytes(
        titulo=f"Comprobante de {comp.tipo.capitalize()}",
        numero=comp.numero_comprobante,
        destinatario=destinatario_nombre,
        concepto=concepto_desc,
        metodo_pago=metodo_pago_str,
        desglose=desglose_items,
        total=total_str
    )
    
    return StreamingResponse(
        pdf_buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=comprobante_{comp.numero_comprobante}.pdf"}
    )