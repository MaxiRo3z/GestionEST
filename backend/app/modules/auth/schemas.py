from pydantic import BaseModel, ConfigDict, field_validator


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    rol: str
    activo: bool


class CambiarPasswordIn(BaseModel):
    password_actual: str
    password_nueva: str


class UsuarioCreate(BaseModel):
    username: str
    password: str
    rol: str = "cliente"

    @field_validator("rol")
    @classmethod
    def _rol_valido(cls, v: str) -> str:
        if v not in ("admin", "cliente"):
            raise ValueError('rol debe ser "admin" o "cliente"')
        return v
