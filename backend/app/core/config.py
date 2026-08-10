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

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
