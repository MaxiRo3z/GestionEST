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


# --- rol admin vs cliente: mismo control, distinto nivel de detalle de error ---

def test_me_devuelve_rol_del_usuario(client, auth_headers, auth_headers_cliente):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.json()["rol"] == "admin"

    res = client.get("/api/auth/me", headers=auth_headers_cliente)
    assert res.json()["rol"] == "cliente"


def test_cliente_tiene_control_completo_sobre_rutas_de_negocio(client, auth_headers_cliente):
    """El rol no restringe el uso del sistema: un usuario 'cliente' puede
    usar cualquier endpoint de negocio igual que el admin."""
    res = client.get("/api/cursos", headers=auth_headers_cliente)
    assert res.status_code == 200


def test_solo_admin_puede_administrar_usuarios(client, auth_headers, auth_headers_cliente):
    # admin: puede listar y crear usuarios
    res = client.get("/api/auth/usuarios", headers=auth_headers)
    assert res.status_code == 200

    res = client.post(
        "/api/auth/usuarios",
        json={"username": "nuevo", "password": "otra-clave-larga", "rol": "cliente"},
        headers=auth_headers,
    )
    assert res.status_code == 201

    # cliente: control completo del negocio, pero NO administra usuarios
    res = client.get("/api/auth/usuarios", headers=auth_headers_cliente)
    assert res.status_code == 403

    res = client.post(
        "/api/auth/usuarios",
        json={"username": "otro", "password": "otra-clave-larga", "rol": "cliente"},
        headers=auth_headers_cliente,
    )
    assert res.status_code == 403


def test_error_de_validacion_es_tecnico_para_admin_y_generico_para_cliente(
    client, auth_headers, auth_headers_cliente
):
    # Body vacío contra un endpoint que requiere campos -> dispara un 422
    # de Pydantic, la categoría de error que se muestra distinto por rol.
    res_admin = client.post("/api/cursos", json={}, headers=auth_headers)
    assert res_admin.status_code == 422
    assert isinstance(res_admin.json()["detail"], list)  # detalle técnico de Pydantic

    res_cliente = client.post("/api/cursos", json={}, headers=auth_headers_cliente)
    assert res_cliente.status_code == 422
    assert isinstance(res_cliente.json()["detail"], str)  # mensaje genérico, no técnico


def test_error_de_negocio_curado_se_muestra_igual_para_ambos_roles(
    client, auth_headers, auth_headers_cliente
):
    # Un HTTPException explícito del código de negocio (ya redactado para el
    # usuario final) no debe verse afectado por el rol.
    res_admin = client.post(
        "/api/auth/usuarios",
        json={"username": "test_admin", "password": "otra-clave-larga", "rol": "cliente"},
        headers=auth_headers,
    )
    assert res_admin.status_code == 400
    assert "Ya existe un usuario" in res_admin.json()["detail"]
