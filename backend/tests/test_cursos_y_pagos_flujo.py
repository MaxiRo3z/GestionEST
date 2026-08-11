"""
Flujo completo curso -> alumno -> inscripción -> matrícula -> cuota, y el
ajuste de arancel (regresión del bug de performance/alcance: un ajuste en
un curso NO debía tocar cuotas de otro curso).
"""


def _crear_curso(client, headers, nombre="Peluquería", valor_matricula="10000", valor_cuota="5000", duracion=3):
    res = client.post(
        "/api/cursos",
        json={"nombre": nombre, "duracion_meses": duracion, "valor_matricula": valor_matricula, "valor_cuota": valor_cuota},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def _crear_alumno(client, headers, dni="30111222", nombre="Ana", apellido="Gómez"):
    res = client.post("/api/alumnos", json={"dni": dni, "nombre": nombre, "apellido": apellido}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def _inscribir(client, headers, alumno_id, curso_id, dia_vencimiento=10):
    res = client.post(
        "/api/inscripciones",
        json={"alumno_id": alumno_id, "curso_id": curso_id, "dia_vencimiento": dia_vencimiento},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_inscripcion_genera_plan_de_cuotas_completo(client, auth_headers):
    curso = _crear_curso(client, auth_headers, duracion=3)
    alumno = _crear_alumno(client, auth_headers)
    inscripcion = _inscribir(client, auth_headers, alumno["id"], curso["id"])

    res = client.get(f"/api/pagos/cuotas?inscripcion_id={inscripcion['id']}", headers=auth_headers)
    assert res.status_code == 200
    cuotas = res.json()
    assert len(cuotas) == 3  # duracion_meses del curso
    assert all(c["estado"] == "pendiente" for c in cuotas)
    assert all(c["valor_original"] == "5000.00" for c in cuotas)


def test_no_se_puede_pagar_la_misma_cuota_dos_veces(client, auth_headers, metodo_efectivo):
    curso = _crear_curso(client, auth_headers, duracion=1)
    alumno = _crear_alumno(client, auth_headers)
    inscripcion = _inscribir(client, auth_headers, alumno["id"], curso["id"])
    cuota_id = client.get(f"/api/pagos/cuotas?inscripcion_id={inscripcion['id']}", headers=auth_headers).json()[0]["id"]

    res = client.post(f"/api/pagos/cuotas/{cuota_id}/pagar", json={"metodo_pago_id": metodo_efectivo.id}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["valor_total"] == "5000.00"

    res = client.post(f"/api/pagos/cuotas/{cuota_id}/pagar", json={"metodo_pago_id": metodo_efectivo.id}, headers=auth_headers)
    assert res.status_code == 400
    assert "ya está pagada" in res.json()["detail"]


def test_recargo_por_tarjeta_de_credito_en_pago_de_matricula(client, auth_headers, metodo_credito):
    curso = _crear_curso(client, auth_headers, valor_matricula="10000", duracion=1)
    alumno = _crear_alumno(client, auth_headers)
    inscripcion = _inscribir(client, auth_headers, alumno["id"], curso["id"])

    res = client.post(
        "/api/pagos/matricula/pagar",
        json={"inscripcion_id": inscripcion["id"], "metodo_pago_id": metodo_credito.id},
        headers=auth_headers,
    )
    assert res.status_code == 200
    pago = res.json()
    assert pago["valor_base"] == "10000.00"
    assert pago["recargo_aplicado"] == "1500.00"  # 15%
    assert pago["valor_total"] == "11500.00"
    # El pago de matrícula/cuota genera comprobante automáticamente
    assert pago["comprobante_id"] is not None


def test_ajuste_de_arancel_no_afecta_cuotas_de_otro_curso(client, auth_headers):
    """Regresión: aplicar_ajuste_arancel() filtraba en Python después de traer
    TODAS las cuotas pendientes del sistema; el fix filtra por curso_id en la
    propia consulta SQL. Este test verifica el resultado funcional: un ajuste
    en el curso A no debe tocar ni una sola cuota del curso B."""
    curso_a = _crear_curso(client, auth_headers, nombre="Curso A", valor_cuota="1000", duracion=2)
    curso_b = _crear_curso(client, auth_headers, nombre="Curso B", valor_cuota="2000", duracion=2)
    alumno_a = _crear_alumno(client, auth_headers, dni="1111", nombre="Alumno", apellido="A")
    alumno_b = _crear_alumno(client, auth_headers, dni="2222", nombre="Alumno", apellido="B")
    _inscribir(client, auth_headers, alumno_a["id"], curso_a["id"])
    _inscribir(client, auth_headers, alumno_b["id"], curso_b["id"])

    res = client.post(
        f"/api/cursos/{curso_a['id']}/ajustar-arancel",
        json={"nuevo_valor_cuota": "1500", "motivo": "Aumento de prueba"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["cuotas_actualizadas"] == 2  # las 2 cuotas del curso A

    cuotas_b = client.get("/api/pagos/cuotas", headers=auth_headers).json()
    cuotas_del_b = [c for c in cuotas_b if c["valor_original"] == "2000.00"]
    assert all(c["valor_actualizado"] == "2000.00" for c in cuotas_del_b)  # sin tocar
