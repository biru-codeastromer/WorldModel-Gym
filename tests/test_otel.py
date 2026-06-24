from __future__ import annotations

from fastapi.testclient import TestClient


def _reset_tracing_guard(modules) -> None:
    # ``setup_tracing`` is idempotent via a module-level guard; reset it so each
    # test exercises a fresh setup path on the freshly-reloaded modules.
    modules["worldmodel_server.otel"]._TRACING_CONFIGURED = False


def test_setup_tracing_is_noop_when_endpoint_unset(server_modules, monkeypatch):
    monkeypatch.delenv("WMG_OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    modules = server_modules()
    otel = modules["worldmodel_server.otel"]
    _reset_tracing_guard(modules)

    from opentelemetry import trace

    provider_before = trace.get_tracer_provider()

    # Disabled by default: returns False, configures nothing, raises nothing.
    configured = otel.setup_tracing(modules.app, modules["worldmodel_server.db"].engine)

    assert configured is False
    assert trace.get_tracer_provider() is provider_before


def test_app_serves_healthz_with_tracing_enabled(server_modules, monkeypatch):
    # A dummy, unreachable endpoint: the BatchSpanProcessor buffers spans and any
    # export failure happens off the request path, so requests must still succeed
    # without a live collector.
    monkeypatch.setenv("WMG_OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
    monkeypatch.setenv("WMG_OTEL_SERVICE_NAME", "worldmodel-gym-test")
    modules = server_modules()
    otel = modules["worldmodel_server.otel"]
    _reset_tracing_guard(modules)

    configured = otel.setup_tracing(modules.app, modules["worldmodel_server.db"].engine)
    assert configured is True

    # Idempotent: a second call after a successful setup is a no-op.
    assert otel.setup_tracing(modules.app, modules["worldmodel_server.db"].engine) is False

    with TestClient(modules.app) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_request_log_carries_trace_ids_when_active(server_modules, monkeypatch):
    monkeypatch.setenv("WMG_OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces")
    modules = server_modules()
    otel = modules["worldmodel_server.otel"]
    request_logging = modules["worldmodel_server.request_logging"]
    _reset_tracing_guard(modules)

    assert otel.setup_tracing(modules.app, modules["worldmodel_server.db"].engine) is True

    from opentelemetry import trace

    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("unit-test-span"):
        ctx = request_logging._current_trace_context()

    assert len(ctx["trace_id"]) == 32
    assert len(ctx["span_id"]) == 16


def test_request_log_has_no_trace_ids_when_disabled(server_modules, monkeypatch):
    monkeypatch.delenv("WMG_OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    modules = server_modules()
    request_logging = modules["worldmodel_server.request_logging"]

    # Tracing disabled: the helper short-circuits to an empty context and
    # ``log_request_event`` therefore adds no trace/span ids.
    assert request_logging._current_trace_context() == {}


def test_tracing_enabled_flag_tracks_endpoint(server_modules, monkeypatch):
    monkeypatch.delenv("WMG_OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    modules = server_modules()
    assert modules["worldmodel_server.config"].settings.tracing_enabled is False

    monkeypatch.setenv("WMG_OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
    modules = server_modules()
    assert modules["worldmodel_server.config"].settings.tracing_enabled is True
