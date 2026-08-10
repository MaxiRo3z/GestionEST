import logging
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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
from app.modules.comprobantes.router import router as comprobantes_router

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
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
app.include_router(comprobantes_router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENV}


# --- Servir el frontend ya compilado (npm run build) desde el mismo proceso/puerto ---
#
# resource_path() resuelve la carpeta correcta tanto corriendo con
# "uvicorn app.main:app" en desarrollo, como empaquetado con PyInstaller
# (donde los archivos van a sys._MEIPASS en tiempo de ejecución).
def resource_path(relative: str) -> Path:
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    else:
        base = Path(__file__).resolve().parent.parent  # carpeta backend/
    return base / relative


frontend_dist = resource_path("frontend_dist")

if frontend_dist.exists():
    # Sirve JS/CSS/imágenes con su hash de nombre bajo /assets
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    # Cualquier ruta que NO empiece con /api, /health, /docs, /openapi.json
    # devuelve index.html, para que react-router-dom maneje el ruteo en el cliente.
    @app.get("/{full_path:path}")
    def spa_catch_all(request: Request, full_path: str):
        index_file = frontend_dist / "index.html"
        return FileResponse(index_file)
else:
    logging.getLogger("app.main").warning(
        "No se encontró frontend_dist — corriendo solo como API (modo desarrollo)."
    )
