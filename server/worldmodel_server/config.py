from __future__ import annotations

import os
from pathlib import Path


def _split_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def _normalize_db_url(raw: str) -> str:
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql+psycopg://", 1)
    if raw.startswith("postgresql://") and "+psycopg" not in raw:
        return raw.replace("postgresql://", "postgresql+psycopg://", 1)
    return raw


def _as_bool(raw: str | None, default: bool) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[2]
        self.app_name = "WorldModel Gym API"
        self.environment = os.getenv("WMG_ENV", "development").lower()
        self.db_url = _normalize_db_url(os.getenv("WMG_DB_URL", "sqlite:///./worldmodel_gym.db"))
        self.db_pool_size = int(os.getenv("WMG_DB_POOL_SIZE", "5"))
        self.db_max_overflow = int(os.getenv("WMG_DB_MAX_OVERFLOW", "10"))
        self.auto_migrate = _as_bool(os.getenv("WMG_AUTO_MIGRATE"), True)
        self.upload_token = os.getenv("WMG_UPLOAD_TOKEN", "dev-token")
        self.legacy_upload_token_enabled = _as_bool(
            os.getenv("WMG_LEGACY_UPLOAD_TOKEN_ENABLED"),
            True,
        )
        self.storage_dir = Path(os.getenv("WMG_STORAGE_DIR", "server/storage"))
        self.storage_backend = os.getenv("WMG_STORAGE_BACKEND", "local").lower()
        self.s3_bucket = os.getenv("WMG_S3_BUCKET", "")
        self.s3_region = os.getenv("WMG_S3_REGION", "")
        self.s3_endpoint_url = os.getenv("WMG_S3_ENDPOINT_URL")
        self.s3_access_key_id = os.getenv("WMG_S3_ACCESS_KEY_ID")
        self.s3_secret_access_key = os.getenv("WMG_S3_SECRET_ACCESS_KEY")
        self.s3_prefix = os.getenv("WMG_S3_PREFIX", "runs")
        self.cors_origins = _split_csv(
            os.getenv(
                "WMG_CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000",
            )
        )
        self.max_upload_bytes = int(os.getenv("WMG_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
        self.public_read_rate_limit_per_minute = int(
            os.getenv("WMG_PUBLIC_READ_RATE_LIMIT_PER_MINUTE", "240")
        )
        self.authenticated_write_rate_limit_per_minute = int(
            os.getenv("WMG_AUTH_WRITE_RATE_LIMIT_PER_MINUTE", "120")
        )
        self.legacy_token_rate_limit_per_minute = int(
            os.getenv("WMG_LEGACY_TOKEN_RATE_LIMIT_PER_MINUTE", "60")
        )
        self.enable_metrics = _as_bool(os.getenv("WMG_ENABLE_METRICS"), True)
        self.seed_demo_data = _as_bool(os.getenv("WMG_SEED_DEMO_DATA"), False)
        self.log_json = _as_bool(os.getenv("WMG_LOG_JSON"), True)
        self.log_level = os.getenv("WMG_LOG_LEVEL", "INFO").upper()
        self.bootstrap_api_key = os.getenv("WMG_BOOTSTRAP_API_KEY", "")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def validate(self) -> None:
        if self.storage_backend not in {"local", "s3"}:
            raise RuntimeError("WMG_STORAGE_BACKEND must be 'local' or 's3'")
        if self.storage_backend == "s3" and not self.s3_bucket:
            raise RuntimeError("WMG_S3_BUCKET must be set when WMG_STORAGE_BACKEND=s3")
        if (
            self.is_production
            and self.legacy_upload_token_enabled
            and self.upload_token == "dev-token"
        ):
            raise RuntimeError("WMG_UPLOAD_TOKEN must be set to a non-default value in production")


settings = Settings()
