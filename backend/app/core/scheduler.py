"""
Tareas programadas que corren solas dentro del mismo proceso del backend,
sin depender de un cron externo (útil tanto en la notebook local como en
un servicio en la nube tipo Render, donde no siempre hay acceso a cron).

Se arrancan desde app/main.py en el evento de startup y se apagan en el
shutdown. Cada job abre su propia sesión de base de datos (no puede
depender de la sesión de un request, porque no corre dentro de uno).
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.timezone import TZ
from app.db.session import SessionLocal

logger = logging.getLogger("app.scheduler")

scheduler = BackgroundScheduler(timezone=TZ)


def _job_marcar_vencidas() -> None:
    from app.modules.pagos.service import marcar_cuotas_vencidas

    db = SessionLocal()
    try:
        n = marcar_cuotas_vencidas(db)
        if n:
            logger.info("Job marcar-vencidas: %d cuota(s) pasaron a 'vencida'.", n)
    except Exception:
        logger.exception("Job marcar-vencidas falló.")
    finally:
        db.close()


def _job_extender_gastos_recurrentes() -> None:
    from app.modules.gastos.service import extender_recurrentes

    db = SessionLocal()
    try:
        n = extender_recurrentes(db)
        if n:
            logger.info("Job extender-gastos-recurrentes: %d fila(s) nuevas proyectadas.", n)
    except Exception:
        logger.exception("Job extender-gastos-recurrentes falló.")
    finally:
        db.close()


def iniciar_scheduler() -> None:
    if scheduler.running:
        return

    # 03:00 hora local: horario de bajo uso, después de la medianoche para
    # que las cuotas que vencieron "hoy" ya se hayan podido cobrar durante el día.
    scheduler.add_job(
        _job_marcar_vencidas, CronTrigger(hour=3, minute=0),
        id="marcar_vencidas_diario", replace_existing=True,
    )
    scheduler.add_job(
        _job_extender_gastos_recurrentes, CronTrigger(hour=3, minute=15),
        id="extender_gastos_recurrentes_diario", replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler iniciado (marcar-vencidas y extender-gastos-recurrentes corren todos los días).")

    # Además de la corrida diaria, se ejecutan una vez al arrancar el proceso:
    # así un sistema recién instalado (o que estuvo apagado varios días,
    # típico de una notebook que no queda prendida) no espera hasta las 03:00
    # para ponerse al día.
    _job_marcar_vencidas()
    _job_extender_gastos_recurrentes()


def detener_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
