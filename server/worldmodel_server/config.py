from __future__ import annotations

import os
from pathlib import Path


def _split_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    def __init__(self) -> None:
        self.app_name = "WorldModel Gym API"
        self.environment = os.getenv("WMG_ENV", "development").lower()
        self.db_url = os.getenv("WMG_DB_URL", "sqlite:///./worldmodel_gym.db")
        self.upload_token = os.getenv("WMG_UPLOAD_TOKEN", "dev-token")
        self.storage_dir = Path(os.getenv("WMG_STORAGE_DIR", "server/storage"))
        self.cors_origins = _split_csv(
            os.getenv(
                "WMG_CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000",
            )
        )
        self.max_upload_bytes = int(os.getenv("WMG_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def validate(self) -> None:
        if self.is_production and self.upload_token == "dev-token":
            raise RuntimeError("WMG_UPLOAD_TOKEN must be set to a non-default value in production")


settings = Settings()
