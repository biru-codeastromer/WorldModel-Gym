from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from worldmodel_server.config import settings


class Base(DeclarativeBase):
    pass


def build_engine_kwargs(db_url: str) -> dict:
    url = make_url(db_url)
    engine_kwargs: dict = {"future": True}
    if url.get_backend_name() == "sqlite":
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    else:
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_size"] = settings.db_pool_size
        engine_kwargs["max_overflow"] = settings.db_max_overflow
    return engine_kwargs


print(f"[db] Creating engine for: {settings.db_url.split('://')[0]}://***@{settings.db_url.split('@')[-1] if '@' in settings.db_url else '(no-host)'}", flush=True)
engine = create_engine(settings.db_url, **build_engine_kwargs(settings.db_url))
print(f"[db] Engine created successfully, dialect: {engine.dialect.name}", flush=True)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


def get_session():
    with SessionLocal() as session:
        yield session
