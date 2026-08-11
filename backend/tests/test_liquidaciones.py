"""
Liquidaciones docentes: matemática de la generación automática, y la
regresión del bug de severidad alta donde editar una liquidación restaba
el descuento dos veces (ver profesores/router.py editar_liquidacion).
"""


def _crear_profesor(client, headers, valor_hora="1000"):
    res = client.post("/api/profesores", json={"nombre": "Prof. Test", "valor_hora": valor_hora}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def _crear_curso(client, headers):
    res = client.post(
        "/api/cursos",
        json={"nombre": "Curso X", "duracion_meses": 1, "valor_matricula": "1000", "valor_cuota": "1000"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def _cargar_asistencia(client, headers, profesor_id, curso_id, fecha, horas_asignadas, horas_trabajadas):
    res = client.post(
        "/api/profesores/asistencias",
        json={
            "profesor_id": profesor_id, "curso_id": curso_id, "fecha": fecha,
            "horas_asignadas": horas_asignadas, "horas_trabajadas": horas_trabajadas,
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_generar_liquidacion_descuenta_horas_no_trabajadas_pero_no_dos_veces(client, auth_headers):
    profesor = _crear_profesor(client, auth_headers, valor_hora="1000")
    curso = _crear_curso(client, auth_headers)

    # 10 hs asignadas, solo 8 trabajadas (2 hs de inasistencia)
    _cargar_asistencia(client, auth_headers, profesor["id"], curso["id"], "2026-03-05", "10", "8")

    res = client.post(
        "/api/profesores/liquidaciones/generar",
        json={"profesor_id": profesor["id"], "periodo": "2026-03-01"},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    liq = res.json()

    assert liq["horas_totales"] == "8.00"
    assert liq["valor_bruto"] == "8000.00"  # 8 hs * 1000 (solo lo trabajado)
    assert liq["descuentos"] == "2000.00"  # 2 hs * 1000 (informativo)
    # Clave: el neto NO vuelve a restar el descuento, porque el bruto ya
    # se calculó sobre horas trabajadas únicamente.
    assert liq["valor_neto"] == "8000.00"


def test_editar_liquidacion_no_descuenta_dos_veces(client, auth_headers):
    """Regresión del bug de severidad alta: antes del fix, PUT
    /liquidaciones/{id} calculaba valor_neto = valor_bruto - descuentos,
    mientras que generar_liquidacion() dejaba valor_neto = valor_bruto (el
    descuento ya estaba reflejado en las horas trabajadas). Guardar sin
    cambiar nada le restaba el descuento una segunda vez."""
    profesor = _crear_profesor(client, auth_headers, valor_hora="1000")
    curso = _crear_curso(client, auth_headers)
    _cargar_asistencia(client, auth_headers, profesor["id"], curso["id"], "2026-03-05", "10", "8")

    generada = client.post(
        "/api/profesores/liquidaciones/generar",
        json={"profesor_id": profesor["id"], "periodo": "2026-03-01"},
        headers=auth_headers,
    ).json()
    assert generada["valor_neto"] == "8000.00"

    # Editar "sin cambiar nada" (mismos valores que ya tenía)
    editada = client.put(
        f"/api/profesores/liquidaciones/{generada['id']}",
        json={"horas_totales": generada["horas_totales"], "descuentos": generada["descuentos"]},
        headers=auth_headers,
    )
    assert editada.status_code == 200, editada.text
    body = editada.json()

    assert body["valor_bruto"] == "8000.00"
    # Si el bug estuviera de vuelta, esto daría "6000.00" (8000 - 2000 de nuevo).
    assert body["valor_neto"] == "8000.00"


def test_no_se_puede_generar_liquidacion_de_periodo_ya_pagado(client, auth_headers):
    profesor = _crear_profesor(client, auth_headers)
    curso = _crear_curso(client, auth_headers)
    _cargar_asistencia(client, auth_headers, profesor["id"], curso["id"], "2026-04-05", "5", "5")

    liq = client.post(
        "/api/profesores/liquidaciones/generar",
        json={"profesor_id": profesor["id"], "periodo": "2026-04-01"},
        headers=auth_headers,
    ).json()

    pagada = client.post(f"/api/profesores/liquidaciones/{liq['id']}/marcar-pagada", headers=auth_headers)
    assert pagada.status_code == 200
    assert pagada.json()["pagado"] is True

    # Recalcular sobre un período ya pagado debe fallar
    res = client.post(
        "/api/profesores/liquidaciones/generar",
        json={"profesor_id": profesor["id"], "periodo": "2026-04-15"},  # mismo mes, distinto día
        headers=auth_headers,
    )
    assert res.status_code == 400

    # Y tampoco se puede editar una liquidación ya pagada
    res = client.put(
        f"/api/profesores/liquidaciones/{liq['id']}",
        json={"horas_totales": "999", "descuentos": "0"},
        headers=auth_headers,
    )
    assert res.status_code == 400
