"""
Regresión: antes no había restricción de unicidad en asistencias_profesores,
así que la misma asistencia (profesor + curso + fecha) se podía cargar dos
veces e inflar las horas de la liquidación. Ahora el modelo tiene un
UniqueConstraint y el endpoint devuelve un 400 legible en vez de romper.
También se verifica que el flujo de "corregir sin duplicar" (PUT) funcione.
"""


def _crear_profesor(client, headers):
    return client.post("/api/profesores", json={"nombre": "Prof. Test", "valor_hora": "1000"}, headers=headers).json()


def _crear_curso(client, headers):
    return client.post(
        "/api/cursos",
        json={"nombre": "Curso Y", "duracion_meses": 1, "valor_matricula": "1000", "valor_cuota": "1000"},
        headers=headers,
    ).json()


def test_cargar_la_misma_asistencia_dos_veces_devuelve_400(client, auth_headers):
    profesor = _crear_profesor(client, auth_headers)
    curso = _crear_curso(client, auth_headers)
    payload = {
        "profesor_id": profesor["id"], "curso_id": curso["id"], "fecha": "2026-05-10",
        "horas_asignadas": "4", "horas_trabajadas": "4",
    }

    primera = client.post("/api/profesores/asistencias", json=payload, headers=auth_headers)
    assert primera.status_code == 201

    segunda = client.post("/api/profesores/asistencias", json=payload, headers=auth_headers)
    assert segunda.status_code == 400
    assert "Ya existe una asistencia" in segunda.json()["detail"]


def test_editar_asistencia_existente_corrige_sin_duplicar(client, auth_headers):
    profesor = _crear_profesor(client, auth_headers)
    curso = _crear_curso(client, auth_headers)
    creada = client.post(
        "/api/profesores/asistencias",
        json={"profesor_id": profesor["id"], "curso_id": curso["id"], "fecha": "2026-05-11",
              "horas_asignadas": "4", "horas_trabajadas": "2"},
        headers=auth_headers,
    ).json()

    editada = client.put(
        f"/api/profesores/asistencias/{creada['id']}",
        json={"horas_asignadas": "4", "horas_trabajadas": "4", "observacion": "corregido"},
        headers=auth_headers,
    )
    assert editada.status_code == 200
    assert editada.json()["horas_trabajadas"] == "4.00"

    # Sigue habiendo un solo registro para ese profesor/curso/fecha
    todas = client.get(f"/api/profesores/asistencias?fecha=2026-05-11", headers=auth_headers).json()
    assert len(todas) == 1


def test_mismo_profesor_puede_tener_asistencia_en_dos_cursos_el_mismo_dia(client, auth_headers):
    profesor = _crear_profesor(client, auth_headers)
    curso_1 = _crear_curso(client, auth_headers)
    curso_2 = client.post(
        "/api/cursos",
        json={"nombre": "Curso Z", "duracion_meses": 1, "valor_matricula": "1000", "valor_cuota": "1000"},
        headers=auth_headers,
    ).json()

    payload_base = {"profesor_id": profesor["id"], "fecha": "2026-05-12", "horas_asignadas": "2", "horas_trabajadas": "2"}

    r1 = client.post("/api/profesores/asistencias", json={**payload_base, "curso_id": curso_1["id"]}, headers=auth_headers)
    r2 = client.post("/api/profesores/asistencias", json={**payload_base, "curso_id": curso_2["id"]}, headers=auth_headers)
    assert r1.status_code == 201
    assert r2.status_code == 201
