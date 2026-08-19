"""
Edición de la ficha del profesor (nombre, DNI, valor/hora, activo): permite
corregir errores de tipeo al ingresar los datos sin borrar y recrear el
registro (lo que perdería el historial de asistencias/liquidaciones ya
asociado a ese profesor_id).
"""


def _crear_profesor(client, headers, nombre="Prof. Test", dni=None, valor_hora="1000"):
    payload = {"nombre": nombre, "valor_hora": valor_hora}
    if dni is not None:
        payload["dni"] = dni
    res = client.post("/api/profesores", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_editar_profesor_corrige_datos(client, auth_headers):
    profesor = _crear_profesor(client, auth_headers, nombre="Prof. Tets", dni="11111111", valor_hora="1000")

    res = client.put(
        f"/api/profesores/{profesor['id']}",
        json={"nombre": "Prof. Test", "dni": "11111111", "valor_hora": "1200", "activo": True},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["nombre"] == "Prof. Test"
    assert body["valor_hora"] == "1200.00"
    assert body["activo"] is True


def test_editar_profesor_permite_desactivar(client, auth_headers):
    profesor = _crear_profesor(client, auth_headers)

    res = client.put(
        f"/api/profesores/{profesor['id']}",
        json={"nombre": profesor["nombre"], "valor_hora": profesor["valor_hora"], "activo": False},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["activo"] is False


def test_editar_profesor_permite_borrar_el_dni(client, auth_headers):
    """Si el DNI se había ingresado mal y se decide dejarlo en blanco hasta
    confirmarlo, el endpoint tiene que aceptar dni=None (no es un campo
    obligatorio en el modelo)."""
    profesor = _crear_profesor(client, auth_headers, dni="12345678")

    res = client.put(
        f"/api/profesores/{profesor['id']}",
        json={"nombre": profesor["nombre"], "dni": None, "valor_hora": profesor["valor_hora"], "activo": True},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["dni"] is None


def test_editar_profesor_inexistente_da_404(client, auth_headers):
    res = client.put(
        "/api/profesores/9999",
        json={"nombre": "No existe", "valor_hora": "1000", "activo": True},
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_editar_profesor_no_permite_dni_duplicado(client, auth_headers):
    _crear_profesor(client, auth_headers, nombre="Prof A", dni="22222222")
    prof_b = _crear_profesor(client, auth_headers, nombre="Prof B", dni="33333333")

    res = client.put(
        f"/api/profesores/{prof_b['id']}",
        json={"nombre": "Prof B", "dni": "22222222", "valor_hora": "1000", "activo": True},
        headers=auth_headers,
    )
    assert res.status_code == 400, res.text
