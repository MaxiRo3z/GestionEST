"""Autenticación: rutas protegidas, login, cambio de contraseña."""


def test_rutas_de_negocio_requieren_token(client):
    res = client.get("/api/cursos")
    assert res.status_code == 401


def test_health_no_requiere_token(client):
    res = client.get("/health")
    assert res.status_code == 200


def test_login_con_password_incorrecta_falla(client, usuario_test):
    res = client.post("/api/auth/login", json={"username": "test_admin", "password": "incorrecta"})
    assert res.status_code == 401


def test_login_correcto_permite_acceder_a_rutas_protegidas(client, auth_headers):
    res = client.get("/api/cursos", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_me_devuelve_usuario_autenticado(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["username"] == "test_admin"


def test_token_invalido_es_rechazado(client):
    res = client.get("/api/cursos", headers={"Authorization": "Bearer no-soy-un-token-valido"})
    assert res.status_code == 401


def test_cambiar_password_y_volver_a_loguearse(client, auth_headers):
    res = client.post(
        "/api/auth/cambiar-password",
        json={"password_actual": "clave-segura-123", "password_nueva": "otra-clave-nueva"},
        headers=auth_headers,
    )
    assert res.status_code == 200

    # La contraseña vieja ya no sirve
    res = client.post("/api/auth/login", json={"username": "test_admin", "password": "clave-segura-123"})
    assert res.status_code == 401

    # La nueva sí
    res = client.post("/api/auth/login", json={"username": "test_admin", "password": "otra-clave-nueva"})
    assert res.status_code == 200
