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


def _current_trace_context() -> dict[str, str]:
    """Return the active OpenTelemetry trace/span ids, if any.

    No-op (empty dict) when tracing is disabled or opentelemetry is not
    installed, so log correlation never adds overhead or a hard dependency.
    """
    if not settings.tracing_enabled:
        return {}
    try:
        from opentelemetry import trace
    except ImportError:  # pragma: no cover - optional dependency missing
        return {}
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if not ctx.is_valid:
        return {}
    return {
        "trace_id": format(ctx.trace_id, "032x"),
        "span_id": format(ctx.span_id, "016x"),
    }


def log_request_event(payload: dict[str, object]) -> None:
    logger = logging.getLogger("worldmodel_server.access")
    trace_context = _current_trace_context()
    if trace_context:
        payload = {**payload, **trace_context}
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
