"""Backend application configuration."""
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # App
    app_name: str = "AI Lost & Found"
    base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    
    # Storage & DB
    db_path: str = str(BASE_DIR / "data" / "app.db")
    upload_dir: str = str(BASE_DIR / "data" / "uploads")
    
    # ML Model
    model_path: str = str(BASE_DIR / "data" / "models" / "best_model.pth")
    class_names_path: str = str(BASE_DIR / "data" / "models" / "class_names.json")
    device: str = "auto"
    
    # Security
    secret_key: str = "lost-and-found-super-secret-key-2026"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
