# Instituto ERP — Sistema de Gestión Integral

Sistema de gestión para Instituto de Estética y Peluquería: cursos con
histórico de aranceles, alumnos e inscripciones, cuotas y cobranzas con
recargos por método de pago, profesores y liquidación de sueldos con
descuento automático por inasistencias, asistencia académica, gastos
operativos y caja, y un dashboard de alertas (deudores, vencimientos,
pagos pendientes).

Corre 100% local (notebook, sin internet) con PostgreSQL, y está
arquitecturado para migrar a la nube sin reescribir lógica de negocio.

## Stack

- **Backend:** Python 3 + FastAPI + SQLAlchemy 2.0 + Alembic (migraciones) + PostgreSQL 16
- **Frontend:** React 19 + TypeScript + Vite + React Router + Tailwind CSS
- **Arquitectura:** monolito modular (1 carpeta por dominio de negocio) + bus de eventos interno para desacoplar notificaciones (WhatsApp-ready a futuro)

---

## 1. Requisitos previos

- Python 3.11+
- Node.js 18+
- PostgreSQL 16 (o Docker, para no instalarlo directo en tu notebook)

## 2. Levantar la base de datos

**Opción A — Docker (recomendado, no ensucia tu notebook):**
```bash
cd backend
docker compose up -d
```

**Opción B — PostgreSQL instalado localmente:**
Crear la base y el usuario manualmente:
```sql
CREATE USER instituto_admin WITH PASSWORD 'instituto_pass';
CREATE DATABASE instituto_erp OWNER instituto_admin;
```

## 3. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # ajustar credenciales si hace falta

alembic upgrade head            # crea todas las tablas
python -m app.db.seed           # carga métodos de pago iniciales (efectivo, transferencia, débito, crédito)

uvicorn app.main:app --reload --port 8000
```

La API queda en `http://localhost:8000`. Documentación interactiva
automática (Swagger) en `http://localhost:8000/docs`.

## 4. Frontend

En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173`.

## 5. Uso día a día

Una vez instalado, para arrancar a trabajar solo hace falta (en dos
terminales separadas):
```bash
# Terminal 1
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Si usás Docker para Postgres, primero `docker compose up -d` en `backend/`.

---

## Estructura del proyecto

```
instituto-erp/
├── backend/
│   ├── app/
│   │   ├── core/               # configuración (.env)
│   │   ├── db/                 # sesión SQLAlchemy, registro de modelos, seed
│   │   ├── events/              # bus de eventos interno
│   │   ├── modules/
│   │   │   ├── cursos/          # cursos + histórico de precios + ajuste de arancel
│   │   │   ├── alumnos/         # alumnos + inscripciones + generación de plan de cuotas
│   │   │   ├── pagos/           # cuotas, métodos de pago, pagos, recargos
│   │   │   ├── profesores/      # profesores, asistencia docente, liquidaciones
│   │   │   ├── asistencias/     # asistencia de alumnos
│   │   │   ├── gastos/          # gastos operativos y balance de caja
│   │   │   ├── dashboard/       # alertas: deudores, vencimientos, pendientes
│   │   │   └── notificaciones/  # listeners de eventos (stub, WhatsApp-ready)
│   │   └── main.py
│   ├── alembic/                 # migraciones versionadas
│   ├── requirements.txt
│   └── docker-compose.yml       # PostgreSQL local en contenedor
└── frontend/
    ├── src/
    │   ├── api/                 # cliente HTTP + tipos + llamadas por módulo
    │   ├── components/          # Layout + librería de UI (Card, Button, Modal, etc.)
    │   ├── pages/                # 1 pantalla por módulo de negocio
    │   └── lib/                  # formateo de moneda/fecha
    └── vite.config.ts
```

---

## Decisiones de modelado clave

**Histórico de precios sin romper lo ya pagado.** Cada curso tiene una
tabla `curso_precios` versionada: nunca se hace `UPDATE` sobre un precio
existente, cada aumento inserta una fila nueva. Cada cuota generada
guarda `valor_original` (congelado para siempre, auditoría) y
`valor_actualizado` (lo que hay que cobrar hoy). Un ajuste de arancel
solo puede tocar `valor_actualizado` de cuotas **pendientes o vencidas**;
una cuota ya pagada nunca se modifica. Cada ajuste queda registrado en
`ajustes_precio` con motivo y fecha.

**Recargos por método de pago.** `metodos_pago` tiene un `recargo_pct`
configurable (0% para efectivo/transferencia, y el % que definas para
débito/crédito). El cálculo se hace en el momento de cobrar, sobre el
valor vigente de la cuota o matrícula, y queda guardado en el `pago`
(`valor_base`, `recargo_aplicado`, `valor_total`) para que quede
auditable incluso si después cambia el % configurado.

**Liquidación docente con descuento automático.** Se suman las horas
`trabajadas` (no las `asignadas`) de todas las asistencias del profesor
en el mes: `valor_bruto = horas_trabajadas × valor_hora`. La diferencia
entre horas asignadas y trabajadas queda registrada como `descuentos`
(informativo/auditable). Generar la liquidación de un mes ya liquidado
y pagado está bloqueado; si no está pagada, se puede recalcular.

**Extensibilidad para WhatsApp.** Ningún módulo de negocio (pagos,
cuotas, liquidaciones) sabe que existe WhatsApp. Cuando algo relevante
pasa, emiten un evento interno (`pago.registrado`, `cuota.vencida`,
`liquidacion.generada`) a través de `app/events/bus.py`. Hoy esos
eventos solo se loguean (`app/modules/notificaciones/listeners.py`); el
día que conectes WhatsApp Cloud API / Evolution API / Baileys, se agrega
un listener nuevo ahí y el resto del sistema no se toca.

---

## Roadmap sugerido para seguir extendiendo

1. **Comprobantes en PDF** — `reportlab` ya está en `requirements.txt`,
   falta el endpoint que genere el PDF de un pago o de una liquidación.
2. **Job diario de vencimientos** — el endpoint
   `POST /api/pagos/marcar-vencidas` ya existe; falta programarlo (cron
   local, o `APScheduler` dentro de la app) para que corra solo todos los
   días y dispare el evento `cuota.vencida`.
3. **Integración WhatsApp real** — reemplazar los `logger.info(...)` en
   `app/modules/notificaciones/listeners.py` por llamadas reales a la
   API elegida.
4. **Autenticación** — hoy el sistema no tiene login (pensado para un
   solo usuario administrativo en la notebook del instituto). Si vas a
   migrarlo a la nube con más de una persona operándolo, es el primer
   punto a agregar (JWT + FastAPI `Depends`).
5. **Migración a la nube** — cambiar `DATABASE_URL` a una instancia
   administrada (RDS, Cloud SQL, o un VPS con Docker) no requiere tocar
   una sola línea de lógica de negocio: es exactamente para esto que
   está armado así.
