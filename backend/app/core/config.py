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
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


settings = Settings()
