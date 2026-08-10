"""
Punto de entrada único para el ejecutable empaquetado con PyInstaller.

Reemplaza al comando "uvicorn app.main:app --reload --port 8000" que se usa
en desarrollo. Al ejecutarse:
  1. Aplica las migraciones de Alembic (alembic upgrade head) -- idempotente,
     así que es seguro correrlo en cada arranque.
  2. Corre el seed inicial de métodos de pago solo si la base está vacía.
  3. Levanta uvicorn en modo producción (sin --reload).
  4. Abre el navegador en http://localhost:8000 una vez que el servidor
     responde.

Esto es lo que Inno Setup va a poner como "instituto-backend.exe" y es lo
que dispara el acceso directo de un click en el escritorio.
"""
import logging
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")
log = logging.getLogger("launcher")

APP_PORT = 8000
APP_URL = f"http://localhost:{APP_PORT}"


def resource_path(relative: str) -> Path:
    if getattr(sys, "frozen", False):
        base = Path(sys._MEIPASS)  # type: ignore[attr-defined]
    else:
        base = Path(__file__).resolve().parent
    return base / relative


# CRÍTICO: Settings() de pydantic-settings busca ".env" relativo al directorio
# de trabajo actual (cwd), no relativo a donde están los datos empaquetados.
# Si el .exe se corre parado en dist\instituto-backend\ (cwd = esa carpeta),
# pydantic no encuentra el .env real (que vive en _internal\) y cae en
# silencio al valor por defecto hardcodeado en config.py -- que apunta a un
# host/puerto que puede no existir en esta máquina, y ahí sí se cuelga.
# Por eso este chdir tiene que pasar ANTES de cualquier import de app.*.
if getattr(sys, "frozen", False):
    os.chdir(resource_path("."))


def run_migrations() -> None:
    from alembic import command
    from alembic.config import Config

    log.info("Aplicando migraciones (alembic upgrade head)...")
    alembic_cfg = Config(str(resource_path("alembic.ini")))
    # Nombrada "migrations" en el paquete final para no chocar con la librería "alembic"
    alembic_cfg.set_main_option("script_location", str(resource_path("migrations")))
    command.upgrade(alembic_cfg, "head")
    log.info("Migraciones aplicadas correctamente.")


def run_seed() -> None:
    try:
        from app.db.seed import run as seed_run
        log.info("Verificando datos iniciales (métodos de pago)...")
        seed_run()
    except Exception:
        log.exception("El seed inicial falló (puede que ya existan los datos, continúo igual).")


def open_browser_when_ready() -> None:
    import urllib.request

    for _ in range(60):  # hasta 30s de espera
        try:
            urllib.request.urlopen(f"{APP_URL}/health", timeout=1)
            webbrowser.open(APP_URL)
            return
        except Exception:
            time.sleep(0.5)
    log.warning("El servidor no respondió a tiempo; abrí %s manualmente.", APP_URL)


def main() -> None:
    try:
        run_migrations()
        run_seed()
    except Exception:
        log.exception(
            "No se pudo preparar la base de datos. Verificá que PostgreSQL "
            "esté corriendo (servicio de Windows) y que las credenciales en "
            ".env sean correctas."
        )
        input("Presioná Enter para cerrar...")
        sys.exit(1)

    threading.Thread(target=open_browser_when_ready, daemon=True).start()

    import uvicorn
    from app.main import app

    log.info("Iniciando Instituto ERP en %s", APP_URL)
    uvicorn.run(app, host="127.0.0.1", port=APP_PORT, log_level="info")


if __name__ == "__main__":
    main()
