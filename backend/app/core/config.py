from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configuración central de la aplicación.
    Todo lo que cambia entre entornos (local -> nube) vive acá,
    nunca hardcodeado en el código de negocio.
    """
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = (
        "postgresql://instituto_admin:instituto_pass@localhost:5432/instituto_erp"
    )
    APP_NAME: str = "Instituto ERP"
    ENV: str = "local"

    # En local acepta el default de abajo. En producción (Render), se define
    # como variable de entorno CORS_ORIGINS con dominios separados por coma,
    # ej: "https://instituto-erp.pages.dev,https://miinstituto.com.ar"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Zona horaria de referencia para todo cálculo de "hoy" (vencimientos,
    # fechas de pago, alertas). Importante al migrar a un servidor en la nube
    # cuyo reloj del sistema corre en UTC: sin esto, "hoy" podía correrse un
    # día según la hora en que corriera el proceso. Ver app/core/timezone.py.
    APP_TIMEZONE: str = "America/Argentina/Buenos_Aires"

    # --- Autenticación ---
    # Secreto para firmar los JWT. En producción SIEMPRE se debe sobreescribir
    # con una variable de entorno propia (no dejar el default de acá).
    JWT_SECRET_KEY: str = "change-this-secret-in-production-1a2b3c"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480  # 8 horas de sesión

    # Credenciales del usuario administrador que se crea solo si la tabla
    # "usuarios" está vacía (ver app/db/seed.py). Cambiar la contraseña desde
    # la propia app (POST /api/auth/cambiar-password) después del primer login.
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "instituto2026"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
