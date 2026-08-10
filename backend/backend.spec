# backend.spec
#
# Generar con:  pyinstaller backend.spec
#
# Requisitos antes de correr esto (en TU máquina de desarrollo, no en la del
# cliente):
#   1. cd frontend && npm install && npm run build   -> genera frontend/dist
#   2. Copiar frontend/dist a backend/frontend_dist
#   3. pip install pyinstaller
#   4. Reemplazar backend/app/main.py por el de este kit (main.py)
#   5. Copiar este launcher.py y backend.spec a la carpeta backend/
#
# Resultado: dist/instituto-backend/instituto-backend.exe (carpeta con todo
# adentro, para que Inno Setup la copie completa).

# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hiddenimports = (
    collect_submodules("app")
    + collect_submodules("alembic")
    + collect_submodules("sqlalchemy")
    + collect_submodules("psycopg2")
    + collect_submodules("pydantic")
    + collect_submodules("reportlab")
    + collect_submodules("fpdf")
    + collect_submodules("uvicorn")
)

datas = (
    # La carpeta de migraciones del proyecto YA se llama "migrations" (renombrada
    # desde "alembic" en el propio repo) para no chocar con la librería real
    # "alembic" -- si tuviera el mismo nombre, "import alembic" resuelve mal
    # incluso durante la compilación con PyInstaller, no solo en el paquete final.
    [("migrations", "migrations"), ("alembic.ini", "."), (".env", "."), ("frontend_dist", "frontend_dist")]
    + collect_data_files("reportlab")
)

a = Analysis(
    ["launcher.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="instituto-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # dejalo en True mientras probás; pasá a False para el cliente final
    icon=None,      # poné acá la ruta a un .ico si tenés uno
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="instituto-backend",
)
