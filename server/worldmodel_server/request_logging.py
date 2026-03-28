from __future__ import annotations

import json
import logging

from worldmodel_server.config import settings


def configure_logging() -> None:
    if getattr(configure_logging, "_configured", False):
        return

    logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO))
    configure_logging._configured = True  # type: ignore[attr-defined]


def log_request_event(payload: dict[str, object]) -> None:
    logger = logging.getLogger("worldmodel_server.access")
    if settings.log_json:
        logger.info(json.dumps(payload, default=str))
        return
    logger.info(
        "%s %s -> %s (%sms)",
        payload.get("method"),
        payload.get("path"),
        payload.get("status_code"),
        payload.get("duration_ms"),
    )
