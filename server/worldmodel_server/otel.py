from __future__ import annotations

import logging

from worldmodel_server.config import settings
from worldmodel_server.request_logging import log_system_event

# Module-level guard so :func:`setup_tracing` is safe to call more than once:
# once tracing has been wired up (or deliberately skipped) we do not re-build the
# provider or re-instrument the app/engine.
_TRACING_CONFIGURED = False


def setup_tracing(app, engine) -> bool:
    """Wire up OpenTelemetry distributed tracing when an OTLP endpoint is set.

    Tracing is entirely OPTIONAL and env-gated: when
    ``WMG_OTEL_EXPORTER_OTLP_ENDPOINT`` is empty this returns immediately and
    nothing is configured (no provider override, no exporter, zero overhead).

    When enabled it builds a ``TracerProvider`` with a ``Resource`` carrying the
    configured ``service.name``, attaches a ``BatchSpanProcessor`` feeding an
    http/protobuf ``OTLPSpanExporter`` pointed at the endpoint, and instruments
    both the FastAPI app and the SQLAlchemy engine.

    Every opentelemetry import is guarded so a missing optional dependency (or a
    transient setup failure) never breaks application startup. Idempotent: a
    second call after a successful (or skipped) setup is a no-op.

    Returns ``True`` when tracing was configured on this call, ``False`` when it
    was disabled, already configured, or could not be set up.
    """
    global _TRACING_CONFIGURED

    if _TRACING_CONFIGURED:
        return False
    if not settings.tracing_enabled:
        # Mark configured so we do not re-evaluate on every lifespan startup.
        _TRACING_CONFIGURED = True
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError as exc:  # pragma: no cover - optional dependency missing
        log_system_event(
            "otel_tracing_unavailable",
            level=logging.WARNING,
            error=str(exc),
        )
        _TRACING_CONFIGURED = True
        return False

    try:
        resource = Resource.create({"service.name": settings.otel_service_name})
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint)
        # The BatchSpanProcessor buffers spans and exports them on a background
        # thread, so a slow or unreachable collector never blocks (or fails) a
        # request -- export failures are swallowed by the SDK.
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
        SQLAlchemyInstrumentor().instrument(engine=engine, tracer_provider=provider)
    except Exception as exc:  # pragma: no cover - best-effort, never break startup
        log_system_event(
            "otel_tracing_setup_failed",
            level=logging.WARNING,
            error=str(exc),
        )
        _TRACING_CONFIGURED = True
        return False

    _TRACING_CONFIGURED = True
    log_system_event(
        "otel_tracing_enabled",
        service_name=settings.otel_service_name,
        endpoint=settings.otel_exporter_otlp_endpoint,
    )
    return True
