"""
Listeners de notificaciones. Hoy solo loguean; el día de mañana acá se
conecta WhatsApp Cloud API / Evolution API / Baileys sin tocar el resto
del sistema (pagos, cuotas, liquidaciones no saben que esto existe).
"""
import logging

from app.events.bus import event_bus

logger = logging.getLogger("notificaciones")


@event_bus.on("pago.registrado")
def notificar_pago_registrado(payload: dict) -> None:
    logger.info(f"[stub WhatsApp] Comprobante de pago listo para enviar: {payload}")
    # TODO futuro: whatsapp_client.send_document(payload["telefono"], pdf_recibo)


@event_bus.on("cuota.vencida")
def notificar_cuota_vencida(payload: dict) -> None:
    logger.info(f"[stub WhatsApp] Recordatorio de cuota vencida: {payload}")


@event_bus.on("liquidacion.generada")
def notificar_liquidacion(payload: dict) -> None:
    logger.info(f"[stub WhatsApp] Aviso de liquidación docente: {payload}")


def register_listeners() -> None:
    """Se llama una vez al arrancar la app para asegurar que los decoradores
    de arriba se ejecuten (el import por sí solo ya alcanza, pero esta
    función deja explícito el punto de entrada)."""
    pass
