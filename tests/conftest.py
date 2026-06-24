from __future__ import annotations

import sys
from dataclasses import dataclass
from importlib import import_module, reload
from types import ModuleType
from typing import Any, Callable

import pytest

# The server packages must be (re)imported in dependency order so that a fresh
# environment (sqlite tmp db, tmp storage dir, etc.) is picked up cleanly on
# every test. config is imported first because every other module reads its
# settings at import time.
_SERVER_MODULE_ORDER = [
    "worldmodel_server.config",
    "worldmodel_server.db",
    "worldmodel_server.models",
    "worldmodel_server.storage",
    "worldmodel_server.auth",
    "worldmodel_server.rate_limit",
    "worldmodel_server.request_logging",
    "worldmodel_server.seed",
    "worldmodel_server.migrations",
    "worldmodel_server.main",
]


def _reload_server_modules() -> dict[str, ModuleType]:
    modules: dict[str, ModuleType] = {}
    for name in _SERVER_MODULE_ORDER:
        if name in sys.modules:
            modules[name] = reload(sys.modules[name])
        else:
            modules[name] = import_module(name)
    return modules


@dataclass
class ServerModules:
    """Convenience handle over the freshly-reloaded server modules.

    Exposes the loaded modules plus the helpers server tests reach for most
    often (the app, ``SessionLocal``, ``create_api_key``, key models), so tests
    no longer have to re-derive them from a raw module dict.
    """

    modules: dict[str, ModuleType]

    def __getitem__(self, name: str) -> ModuleType:
        return self.modules[name]

    @property
    def app(self):
        return self.modules["worldmodel_server.main"].app

    @property
    def main(self) -> ModuleType:
        return self.modules["worldmodel_server.main"]

    @property
    def SessionLocal(self):  # noqa: N802 - mirrors the server's SessionLocal name
        return self.modules["worldmodel_server.db"].SessionLocal

    @property
    def create_api_key(self):
        return self.modules["worldmodel_server.auth"].create_api_key

    @property
    def models(self) -> ModuleType:
        return self.modules["worldmodel_server.models"]


@pytest.fixture
def server_modules(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> Callable[..., ServerModules]:
    """Return a loader that sets the test environment and reloads the server.

    Returning a *callable* (rather than the loaded modules directly) keeps the
    fixture flexible: tests that need to tweak environment variables before the
    modules are imported (seed_demo, custom rate limits, oversized-upload caps,
    bootstrap keys, ...) set them and then call the loader. The default values
    mirror the previous hand-rolled ``load_test_modules`` helper so every
    existing assertion keeps passing.
    """

    def _load(
        *,
        seed_demo: bool = False,
        public_limit: int = 240,
        write_limit: int = 120,
    ) -> ServerModules:
        monkeypatch.setenv("WMG_DB_URL", f"sqlite:///{tmp_path / 'test.db'}")
        monkeypatch.setenv("WMG_STORAGE_DIR", str(tmp_path / "storage"))
        monkeypatch.setenv("WMG_UPLOAD_TOKEN", "test-token")
        monkeypatch.setenv("WMG_AUTO_MIGRATE", "true")
        monkeypatch.setenv("WMG_ENABLE_METRICS", "false")
        monkeypatch.setenv("WMG_SEED_DEMO_DATA", "true" if seed_demo else "false")
        monkeypatch.setenv("WMG_PUBLIC_READ_RATE_LIMIT_PER_MINUTE", str(public_limit))
        monkeypatch.setenv("WMG_AUTH_WRITE_RATE_LIMIT_PER_MINUTE", str(write_limit))
        return ServerModules(modules=_reload_server_modules())

    return _load
