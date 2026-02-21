from __future__ import annotations

import os
from pathlib import Path


class Settings:
    app_name: str = "WorldModel Gym API"
    db_url: str = os.getenv("WMG_DB_URL", "sqlite:///./worldmodel_gym.db")
    upload_token: str = os.getenv("WMG_UPLOAD_TOKEN", "dev-token")
    storage_dir: Path = Path(os.getenv("WMG_STORAGE_DIR", "server/storage"))


settings = Settings()
