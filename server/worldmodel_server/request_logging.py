from __future__ import annotations

import json
import logging

from worldmodel_server.config import settings


def configure_logging() -> None:
    if getattr(configure_logging, "_configured", False):
        return

    level = getattr(logging, settings.log_level, logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    if not root_logger.handlers:
        logging.basicConfig(level=level)

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


def log_system_event(
    event: str,
    *,
    level: int = logging.INFO,
    exc_info: bool = False,
    **payload: object,
) -> None:
    logger = logging.getLogger("worldmodel_server.system")
    record = {"event": event, **payload}
    if settings.log_json:
        logger.log(level, json.dumps(record, default=str), exc_info=exc_info)
        return

    message = event
    if payload:
        formatted = " ".join(f"{key}={value}" for key, value in payload.items())
        message = f"{event} {formatted}"
    logger.log(level, message, exc_info=exc_info)
