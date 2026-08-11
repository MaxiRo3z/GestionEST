"""
Punto único para saber "qué día es hoy" y "qué hora es ahora".

Por qué existe: `datetime.now()` / `date.today()` usan la hora del sistema
operativo del proceso. Corriendo local en la notebook del instituto eso
coincide con la hora de Argentina, pero al migrar a un servidor en la nube
(típicamente en UTC) esas llamadas podían adelantarse o atrasarse hasta un
día completo cerca de la medianoche -- afectando vencimientos de cuotas,
fecha de pago de liquidaciones, y las alertas del dashboard.

Todo el código de negocio que necesite "la fecha de hoy" debe importar
`hoy()` de acá en vez de usar `date.today()` directamente.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings

TZ = ZoneInfo(settings.APP_TIMEZONE)


def ahora() -> datetime:
    """Fecha y hora actual, con la zona horaria configurada (APP_TIMEZONE)."""
    return datetime.now(TZ)


def hoy() -> date:
    """Fecha de hoy según la zona horaria configurada (APP_TIMEZONE)."""
    return ahora().date()
