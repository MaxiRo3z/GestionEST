import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")

from app.core.config import settings
from app.db.base import Base  # noqa: F401  (registra todos los modelos)

# Importar listeners registra los @event_bus.on(...) al arrancar el proceso
from app.modules.notificaciones import listeners  # noqa: F401

from app.modules.cursos.router import router as cursos_router
from app.modules.alumnos.router import router as alumnos_router, inscripciones_router
from app.modules.pagos.router import router as pagos_router
from app.modules.profesores.router import router as profesores_router
from app.modules.asistencias.router import router as asistencias_alumnos_router
from app.modules.gastos.router import router as gastos_router
from app.modules.dashboard.router import router as dashboard_router

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cursos_router)
app.include_router(alumnos_router)
app.include_router(inscripciones_router)
app.include_router(pagos_router)
app.include_router(profesores_router)
app.include_router(asistencias_alumnos_router)
app.include_router(gastos_router)
app.include_router(dashboard_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENV}
