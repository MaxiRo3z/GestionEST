"""
Fixtures compartidos. La suite corre sobre SQLite en memoria (no contra el
Postgres real) para poder correr rápido y sin infraestructura, tanto en la
notebook del instituto como en CI. Se usa StaticPool para que todas las
conexiones de un mismo test vean la misma base en memoria (SQLite in-memory
es por conexión por defecto).

IMPORTANTE: esto valida la lógica de negocio (cálculos, reglas, permisos),
no el dialecto SQL de Postgres. Las migraciones de Alembic (que sí usan
sintaxis específica de Postgres) no se ejecutan acá.
"""
import os

os.environ.setdefault("ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.db.base import Base  # noqa: F401  (registra todos los modelos)
from app.db.session import get_db
from app.main import app
from app.modules.auth.models import Usuario
from app.modules.auth.service import hash_password
from app.modules.pagos.models import MetodoPago

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _fresh_db():
    """Crea el esquema antes de cada test y lo tira abajo después: cada test
    arranca de una base completamente limpia, no se pisan entre sí."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def metodo_efectivo(db):
    metodo = MetodoPago(nombre="Efectivo", recargo_pct=0, cuotas_max=None)
    db.add(metodo)
    db.commit()
    db.refresh(metodo)
    return metodo


@pytest.fixture
def metodo_credito(db):
    metodo = MetodoPago(nombre="Tarjeta de Crédito", recargo_pct=15, cuotas_max=0)
    db.add(metodo)
    db.commit()
    db.refresh(metodo)
    return metodo


@pytest.fixture
def usuario_test(db):
    usuario = Usuario(username="test_admin", password_hash=hash_password("clave-segura-123"))
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@pytest.fixture
def auth_headers(client, usuario_test):
    """Loguea al usuario de test y devuelve el header Authorization listo
    para usar en cualquier request protegido."""
    res = client.post("/api/auth/login", json={"username": "test_admin", "password": "clave-segura-123"})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
