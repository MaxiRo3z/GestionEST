#!/usr/bin/env bash
# Desencripta un backup (.dump.gpg) y lo restaura en una base PostgreSQL.
#
# Uso:
#   ./restaurar_backup.sh archivo.dump.gpg "postgresql://usuario:pass@host/db"
#
# Requiere: gnupg y pg_restore (paquete postgresql-client) instalados.
#
# IMPORTANTE: probar siempre primero contra una base de prueba (una
# branch nueva de Neon, o una base local), nunca directo sobre producción.

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Uso: $0 <archivo.dump.gpg> <DATABASE_URL_destino>" >&2
  exit 1
fi

ARCHIVO_CIFRADO="$1"
DESTINO_URL="$2"
ARCHIVO_PLANO="${ARCHIVO_CIFRADO%.gpg}"

if [ ! -f "$ARCHIVO_CIFRADO" ]; then
  echo "No se encontró el archivo: $ARCHIVO_CIFRADO" >&2
  exit 1
fi

echo "Ingresá la passphrase del backup (la misma guardada como BACKUP_GPG_PASSPHRASE en GitHub):"
gpg --output "$ARCHIVO_PLANO" --decrypt "$ARCHIVO_CIFRADO"

echo ""
echo "Vas a restaurar '$ARCHIVO_PLANO' en:"
echo "  $DESTINO_URL"
read -r -p "¿Confirmás? Esto puede sobreescribir datos existentes (s/N): " CONFIRMA
if [ "$CONFIRMA" != "s" ] && [ "$CONFIRMA" != "S" ]; then
  echo "Cancelado."
  rm -f "$ARCHIVO_PLANO"
  exit 0
fi

pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "$DESTINO_URL" "$ARCHIVO_PLANO"

rm -f "$ARCHIVO_PLANO"
echo "Restauración completa."
