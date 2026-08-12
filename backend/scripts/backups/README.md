# Backups de la base de datos (Neon)

Dos capas de protección, sin costo:

1. **PITR de Neon (automática, ya activa):** el plan free de Neon guarda
   hasta 6 horas de historial de cambios (hasta 1 GB). Sirve para
   deshacer un error reciente (ej. "borré una tabla hace 20 minutos")
   restaurando a un punto anterior desde el dashboard de Neon
   (Branches > Restore). No requiere configuración.

2. **Backup diario automático (este workflow):** todos los días a las
   03:00 (Argentina) GitHub Actions genera un `pg_dump` completo de la
   base, lo cifra con GPG (AES-256) y lo sube a un repo privado de
   GitHub separado, con retención de los últimos 30 días. Esta es la
   protección real ante un desastre (Neon te borra el proyecto, se pierde
   el acceso, corrupción de datos, etc.) porque vive fuera de Neon.

## Configuración (una sola vez)

### 1. Crear el repo privado de backups

En GitHub, crear un repositorio nuevo, **privado**, vacío (sin README),
por ejemplo `gestionest-backups`.

### 2. Generar un token de acceso para ese repo

GitHub > Settings > Developer settings > Fine-grained tokens > Generate
new token.

- Repository access: **Only select repositories** → `gestionest-backups`
- Permissions: **Contents: Read and write**
- Copiar el token generado (no se vuelve a mostrar).

### 3. Cargar los secrets en el repo GestionEST

En el repo `GestionEST` (el del código): Settings > Secrets and
variables > Actions > New repository secret. Crear estos tres:

| Secret | Valor |
|---|---|
| `NEON_DATABASE_URL` | La cadena de conexión **directa** de Neon (no la que dice `-pooler`), la misma que usás en `DATABASE_URL` de Render pero sin el pooler |
| `BACKUP_GPG_PASSPHRASE` | Una passphrase larga y random (ej. generada con `openssl rand -base64 32`). Guardarla en un gestor de contraseñas — sin ella no se puede restaurar ningún backup |
| `BACKUP_REPO_TOKEN` | El token generado en el paso 2 |

Si el repo de backups tiene otro nombre o pertenece a otra cuenta,
agregar también una variable de repo (no secret) `BACKUP_REPO` con el
valor `usuario/nombre-repo`. Por defecto el workflow usa
`MaxiRo3z/gestionest-backups`.

### 4. Probar

Una vez cargados los tres secrets, ir a la pestaña **Actions** del repo
GestionEST, elegir el workflow "Backup base de datos (Neon)" y correrlo
manualmente ("Run workflow"). Si termina en verde, revisar que apareció
un archivo `.dump.gpg` en `daily/` del repo de backups.

## Restaurar un backup

1. Clonar (o descargar) el repo de backups y elegir el archivo
   `.dump.gpg` que se quiere restaurar.
2. Desde `backend/scripts/backups/`, correr:

   ```bash
   ./restaurar_backup.sh gestionest_2026-08-12_060000.dump.gpg "postgresql://usuario:pass@host/db"
   ```

3. Pide la passphrase (la misma guardada como `BACKUP_GPG_PASSPHRASE`) y
   luego confirma antes de sobreescribir el destino.

**Recomendación:** probar la restauración contra una branch nueva de
Neon (no producción) al menos una vez, para confirmar que el proceso
funciona antes de necesitarlo en un incidente real.

## Notas

- El dump es full (esquema + datos) con `pg_dump -Fc` (formato custom,
  comprimido).
- Si la base crece mucho con el tiempo, conviene bajar la retención de
  30 días o mover backups viejos a otro almacenamiento — para un ERP
  institucional chico no debería ser un problema en años.
- El repo de backups debe quedar **privado** siempre: aunque el dump
  está cifrado, no tiene sentido exponerlo.
