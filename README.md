# Instituto ERP — Sistema de Gestión Integral

Sistema de gestión para Instituto de Estética y Peluquería: cursos con
histórico de aranceles, alumnos e inscripciones, cuotas y cobranzas con
recargos por método de pago, profesores y liquidación de sueldos con
descuento automático por inasistencias, asistencia académica, gastos
operativos y caja, y un dashboard de alertas (deudores, vencimientos,
pagos pendientes).

Pensado para correr local (notebook, sin internet) con PostgreSQL, y
arquitecturado para migrar a la nube sin reescribir lógica de negocio
(ver `render.yaml`). Requiere login (usuario y contraseña) para operarlo.

## Stack

- **Backend:** Python 3 + FastAPI + SQLAlchemy 2.0 + Alembic (migraciones) + PostgreSQL 16
- **Frontend:** React 19 + TypeScript + Vite + React Router + Tailwind CSS
- **Arquitectura:** monolito modular (1 carpeta por dominio de negocio) + bus de eventos interno para desacoplar notificaciones (WhatsApp-ready a futuro)
- **Autenticación:** JWT (usuario administrador único por defecto, ver abajo)
- **Tareas programadas:** APScheduler, corriendo dentro del propio proceso (sin cron externo)

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

cp .env.example .env            # ajustar credenciales / secretos si hace falta

alembic upgrade head            # crea todas las tablas
python -m app.db.seed           # carga métodos de pago + usuario administrador inicial

uvicorn app.main:app --reload --port 8000
```

La API queda en `http://localhost:8000`. Documentación interactiva
automática (Swagger) en `http://localhost:8000/docs`.

### Login inicial

El seed crea un usuario administrador con las credenciales de `ADMIN_USERNAME`
/ `ADMIN_PASSWORD` del `.env` (por defecto `admin` / `instituto2026`).
**Cambiar la contraseña apenas se instala** desde la propia app, o pegándole
directo a la API:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"instituto2026"}'
# usar el access_token de la respuesta:
curl -X POST http://localhost:8000/api/auth/cambiar-password \
  -H "Authorization: Bearer <access_token>" -H "Content-Type: application/json" \
  -d '{"password_actual":"instituto2026","password_nueva":"<algo-mas-seguro>"}'
```

El seed solo crea el usuario si la tabla `usuarios` está vacía: no pisa una
contraseña que ya hayas cambiado.

## 4. Frontend

En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173`. Al entrar pide login (mismo
usuario/contraseña del punto anterior).

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

## 6. Tests

```bash
# Backend (pytest, corre contra SQLite en memoria, no requiere Postgres)
cd backend
pip install -r requirements-dev.txt
pytest

# Frontend (vitest)
cd frontend
npm run test
```

---

## Estructura del proyecto

```
instituto-erp/
├── backend/
│   ├── app/
│   │   ├── core/                # configuración (.env), zona horaria, scheduler
│   │   ├── db/                  # sesión SQLAlchemy, registro de modelos, seed
│   │   ├── events/               # bus de eventos interno
│   │   ├── modules/
│   │   │   ├── auth/             # usuarios, login (JWT), cambio de contraseña
│   │   │   ├── cursos/           # cursos + histórico de precios + ajuste de arancel
│   │   │   ├── alumnos/          # alumnos + inscripciones + generación de plan de cuotas
│   │   │   ├── pagos/            # cuotas, métodos de pago, pagos, recargos
│   │   │   ├── profesores/       # profesores, asistencia docente, liquidaciones
│   │   │   ├── asistencias/      # asistencia de alumnos
│   │   │   ├── gastos/           # gastos operativos y balance de caja
│   │   │   ├── comprobantes/     # PDF de comprobante de pago (cuota/matrícula)
│   │   │   ├── dashboard/        # alertas: deudores, vencimientos, pendientes
│   │   │   └── notificaciones/   # listeners de eventos (stub, WhatsApp-ready)
│   │   └── main.py
│   ├── migrations/               # migraciones de Alembic versionadas
│   ├── tests/                    # pytest (SQLite en memoria)
│   ├── requirements.txt
│   ├── requirements-dev.txt      # + pytest/httpx, solo para desarrollo
│   └── docker-compose.yml        # PostgreSQL local en contenedor
└── frontend/
    ├── src/
    │   ├── api/                  # cliente HTTP (con auth + reintentos) + tipos + llamadas por módulo
    │   ├── auth/                  # AuthContext (login/logout/sesión)
    │   ├── components/           # Layout + librería de UI (Card, Button, Modal, Pagination, etc.)
    │   ├── pages/                 # 1 pantalla por módulo de negocio + LoginPage
    │   └── lib/                   # useApi (hook de datos), formateo de moneda/fecha
    └── vite.config.ts
```

---

## Decisiones de modelado clave

**Histórico de precios sin romper lo ya pagado.** Cada curso tiene una
tabla `curso_precios` versionada: nunca se hace `UPDATE` sobre un precio
existente, cada aumento inserta una fila nueva. Cada cuota generada
guarda `valor_original` (congelado para siempre, auditoría) y
`valor_actualizado` (lo que hay que cobrar hoy). Un ajuste de arancel
solo puede tocar `valor_actualizado` de cuotas **pendientes o vencidas**
**del curso ajustado** (filtrado en la propia consulta SQL); una cuota ya
pagada, o de otro curso, nunca se toca. Cada ajuste queda registrado en
`ajustes_precio` con motivo y fecha.

**Recargos por método de pago.** `metodos_pago` tiene un `recargo_pct`
configurable (0% para efectivo/transferencia, y el % que definas para
débito/crédito). El cálculo se hace en el momento de cobrar, sobre el
valor vigente de la cuota o matrícula, y queda guardado en el `pago`
(`valor_base`, `recargo_aplicado`, `valor_total`) para que quede
auditable incluso si después cambia el % configurado.

**Liquidación docente con descuento automático.** Se suman las horas
`trabajadas` (no las `asignadas`) de todas las asistencias del profesor
en el mes: `valor_bruto = horas_trabajadas × valor_hora` (ya refleja el
descuento por inasistencias). `descuentos` queda como dato informativo /
auditable de cuánto se descontó respecto de lo asignado, pero **no se
resta de nuevo** de `valor_neto` — ni al generar la liquidación ni al
editarla a mano. Generar la liquidación de un mes ya liquidado y pagado
está bloqueado; si no está pagada, se puede recalcular o editar.

**Asistencia docente sin duplicados.** `asistencias_profesores` tiene una
restricción de unicidad por (profesor, curso, fecha). El frontend ofrece
dos formas de cargarla: por profesor individual ("Cargar asistencia" en
la ficha del profesor) o por día para todo el plantel a la vez ("Cargar
asistencia del día" en Profesores) — en ambos casos, si ya existe una
carga para ese profesor/curso/día, se edita en vez de duplicarla.

**Extensibilidad para WhatsApp.** Ningún módulo de negocio (pagos,
cuotas, liquidaciones) sabe que existe WhatsApp. Cuando algo relevante
pasa, emiten un evento interno (`pago.registrado`, `cuota.vencida`,
`liquidacion.generada`) a través de `app/events/bus.py`. Hoy esos
eventos solo se loguean (`app/modules/notificaciones/listeners.py`); el
día que conectes WhatsApp Cloud API / Evolution API / Baileys, se agrega
un listener nuevo ahí y el resto del sistema no se toca.

**Zona horaria explícita.** Todo cálculo de "hoy" (vencimientos, fecha de
pago, alertas) pasa por `app/core/timezone.py`, que usa `APP_TIMEZONE`
(por defecto `America/Argentina/Buenos_Aires`) en vez de depender de la
hora del sistema operativo del servidor — importante en la nube, donde el
servidor suele correr en UTC.

**Tareas programadas.** `app/core/scheduler.py` corre todos los días
(03:00 hora local) dos jobs, dentro del mismo proceso del backend, sin
cron externo: marcar cuotas vencidas (dispara `cuota.vencida`) y extender
el horizonte de gastos recurrentes. Además corren una vez al arrancar el
proceso, para que un sistema recién instalado o que estuvo apagado unos
días se ponga al día enseguida.

---

## Variables de entorno relevantes (`.env`)

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `CORS_ORIGINS` | Orígenes permitidos (frontend) |
| `APP_TIMEZONE` | Zona horaria para todo cálculo de "hoy" |
| `JWT_SECRET_KEY` | Firma de los tokens de login — **cambiar en producción** |
| `JWT_EXPIRE_MINUTES` | Duración de la sesión (default 8 horas) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Credenciales del usuario administrador que crea el seed la primera vez |

---

## Roadmap sugerido para seguir extendiendo

1. **Integración WhatsApp real** — reemplazar los `logger.info(...)` en
   `app/modules/notificaciones/listeners.py` por llamadas reales a la
   API elegida (Cloud API / Evolution API / Baileys).
2. **Comprobante de liquidación (recibo de sueldo)** — hoy solo se emite
   comprobante en PDF para cuota/matrícula; se sacó del alcance a
   propósito porque por ahora no se le entrega el recibo al profesor. El
   modelo `Comprobante` ya soporta un `tipo` distinto para esto si se
   decide retomarlo.
3. **Multiusuario con roles** — la tabla `usuarios` ya soporta más de un
   registro; si el instituto suma más de una persona operando el sistema,
   agregar un endpoint de alta de usuarios y, si hace falta, roles
   (administrativo vs. solo consulta).
4. **Migración a la nube** — cambiar `DATABASE_URL` a una instancia
   administrada (RDS, Cloud SQL, Neon) no requiere tocar una sola línea
   de lógica de negocio; `render.yaml` ya deja el backend listo para
   desplegar en Render. Revisar `CORS_ORIGINS` y `JWT_SECRET_KEY` de
   producción antes de salir a la nube.
