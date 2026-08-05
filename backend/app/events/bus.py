"""
Bus de eventos interno, en memoria, muy simple (patrón Observer).

Objetivo: que módulos como "pagos" o "cuotas" puedan avisar que algo pasó
("pago.registrado", "cuota.vencida", "liquidacion.generada") sin conocer
quién los escucha. El día que se conecte WhatsApp Cloud API / Evolution
API / Baileys, se agrega un listener nuevo acá adentro y el resto del
sistema no se toca.

Uso:
    from app.events.bus import event_bus

    event_bus.emit("pago.registrado", {"pago_id": 1, "alumno": "..."})

    @event_bus.on("pago.registrado")
    def notificar(payload: dict):
        ...
"""
from collections import defaultdict
from typing import Callable, Any


class EventBus:
    def __init__(self) -> None:
        self._listeners: dict[str, list[Callable[[dict], Any]]] = defaultdict(list)

    def on(self, event_name: str):
        def decorator(func: Callable[[dict], Any]):
            self._listeners[event_name].append(func)
            return func
        return decorator

    def subscribe(self, event_name: str, func: Callable[[dict], Any]) -> None:
        self._listeners[event_name].append(func)

    def emit(self, event_name: str, payload: dict) -> None:
        for listener in self._listeners.get(event_name, []):
            # En producción esto podría encolarse (Celery/RQ) para no bloquear
            # el request. Por ahora, ejecución síncrona simple.
            listener(payload)


event_bus = EventBus()
