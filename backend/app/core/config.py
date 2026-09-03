from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "SMA - Serving Management App"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    
    # Base de Datos (PostgreSQL asyncpg)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/sma_db",
        env="DATABASE_URL"
    )
    
    # Seguridad OWASP & Auth JWT
    JWT_SECRET: str = Field(
        default="SUPER_SECRET_CHANGE_THIS_IN_PRODUCTION_KEY_32BYTES_MIN",
        env="JWT_SECRET"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 Horas turno de trabajo
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Rate Limiting (Peticiones por minuto por IP)
    RATE_LIMIT_PER_MINUTE: int = 100
    AUTH_RATE_LIMIT_PER_MINUTE: int = 5
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://sma.chainpoint.ai",
        "https://app.serving.com.co",
        "https://sma-serving.vercel.app",
        "*"
    ]
    
    # Cloud Storage & Gemini API
    GEMINI_API_KEY: str = Field(default="", env="GEMINI_API_KEY")
    R2_ACCOUNT_ID: str = Field(default="", env="R2_ACCOUNT_ID")
    R2_ACCESS_KEY_ID: str = Field(default="", env="R2_ACCESS_KEY_ID")
    R2_SECRET_ACCESS_KEY: str = Field(default="", env="R2_SECRET_ACCESS_KEY")
    R2_BUCKET_NAME: str = Field(default="sma-files", env="R2_BUCKET_NAME")
    
    # Validación de Seguridad OWASP para JWT Secret en Producción
    @field_validator("JWT_SECRET")
    def validate_jwt_secret(cls, v: str, info) -> str:
        if len(v) < 32 and os.getenv("ENVIRONMENT") == "production":
            raise ValueError("OWASP Security Violation: JWT_SECRET debe tener al menos 32 caracteres en producción.")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
