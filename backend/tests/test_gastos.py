"""Balance de caja y proyección/extensión de gastos recurrentes."""
from datetime import date

from sqlalchemy import select

from app.modules.gastos.models import Gasto
from app.modules.gastos.service import extender_recurrentes, sumar_meses


def test_balance_mensual_ingresos_vs_egresos(client, auth_headers, metodo_efectivo):
    curso = client.post(
        "/api/cursos",
        json={"nombre": "Curso Balance", "duracion_meses": 1, "valor_matricula": "5000", "valor_cuota": "1000"},
        headers=auth_headers,
    ).json()
    alumno = client.post("/api/alumnos", json={"dni": "999", "nombre": "N", "apellido": "N"}, headers=auth_headers).json()
    inscripcion = client.post(
        "/api/inscripciones", json={"alumno_id": alumno["id"], "curso_id": curso["id"], "dia_vencimiento": 10},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/pagos/matricula/pagar",
        json={"inscripcion_id": inscripcion["id"], "metodo_pago_id": metodo_efectivo.id},
        headers=auth_headers,
    )

    hoy = date.today()
    client.post(
        "/api/gastos",
        json={"categoria": "alquiler", "descripcion": "Alquiler", "monto": "2000", "fecha": hoy.isoformat(), "recurrente": False},
        headers=auth_headers,
    )

    res = client.get(f"/api/gastos/balance?anio={hoy.year}&mes={hoy.month}", headers=auth_headers)
    assert res.status_code == 200
    balance = res.json()
    # balance_mensual() devuelve un dict plano (no un response_model Pydantic),
    # así que FastAPI serializa los Decimal como float acá (a diferencia de
    # los demás endpoints, que sí usan response_model y los mandan como string).
    assert balance["ingresos"] == 5000.0  # matrícula pagada
    assert balance["egresos"] == 2000.0
    assert balance["resultado"] == 3000.0


def test_gasto_recurrente_proyecta_11_meses_al_crearse(client, auth_headers):
    hoy = date.today()
    res = client.post(
        "/api/gastos",
        json={"categoria": "servicios", "descripcion": "Internet", "monto": "500", "fecha": hoy.isoformat(), "recurrente": True},
        headers=auth_headers,
    )
    assert res.status_code == 201
    padre = res.json()

    total_generados = 0
    cursor = hoy
    for _ in range(12):
        anio_mes = cursor
        listado = client.get(f"/api/gastos?anio={anio_mes.year}&mes={anio_mes.month}", headers=auth_headers).json()
        total_generados += len([g for g in listado if g["descripcion"] == "Internet"])
        cursor = sumar_meses(cursor, 1)

    assert total_generados == 12  # el mes de alta + 11 futuros
    assert padre["recurrente"] is True


def test_extender_recurrentes_es_idempotente_si_ya_cubre_el_horizonte(client, auth_headers, db):
    hoy = date.today()
    client.post(
        "/api/gastos",
        json={"categoria": "servicios", "descripcion": "Luz", "monto": "300", "fecha": hoy.isoformat(), "recurrente": True},
        headers=auth_headers,
    )

    antes = db.scalars(select(Gasto)).all()
    creados = extender_recurrentes(db)
    despues = db.scalars(select(Gasto)).all()

    assert creados == 0  # ya estaba cubierto el horizonte de 11 meses, no debe duplicar
    assert len(antes) == len(despues)


def test_extender_recurrentes_completa_el_horizonte_cuando_se_achica(client, auth_headers, db):
    hoy = date.today()
    client.post(
        "/api/gastos",
        json={"categoria": "servicios", "descripcion": "Gas", "monto": "300", "fecha": hoy.isoformat(), "recurrente": True},
        headers=auth_headers,
    )

    # Simula el paso del tiempo: recorta a la mitad la proyección ya generada
    # (como si el sistema hubiera estado apagado varios meses sin correr el job).
    padre = db.scalars(select(Gasto).where(Gasto.descripcion == "Gas", Gasto.gasto_padre_id.is_(None))).first()
    hijos = db.scalars(select(Gasto).where(Gasto.gasto_padre_id == padre.id).order_by(Gasto.fecha)).all()
    for gasto_a_borrar in hijos[6:]:
        db.delete(gasto_a_borrar)
    db.commit()

    creados = extender_recurrentes(db)
    assert creados > 0

    horizonte = sumar_meses(hoy, 11)
    ultimo = db.scalars(
        select(Gasto).where((Gasto.id == padre.id) | (Gasto.gasto_padre_id == padre.id)).order_by(Gasto.fecha.desc())
    ).first()
    assert ultimo.fecha >= horizonte
