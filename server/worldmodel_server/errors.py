"""RFC 9457 ``application/problem+json`` error responses.

This module produces structured problem documents while preserving the legacy
contract the Next.js web and Expo mobile clients depend on: every response body
carries a top-level ``"detail"`` string. New machine-readable fields (``type``,
``title``, ``status``, ``instance`` and arbitrary extensions) are layered on top
without breaking that older shape.

The API layer wires the helpers here into FastAPI exception handlers; nothing in
this module touches ``main.py`` directly.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

PROBLEM_CONTENT_TYPE = "application/problem+json"

# Sentinel ``type`` used by RFC 9457 when no problem-type URI is supplied.
DEFAULT_PROBLEM_TYPE = "about:blank"


class ProblemDetail(BaseModel):
    """A single RFC 9457 problem document.

    Unknown keyword arguments are retained as *extension members* (the RFC's
    term for problem-type-specific fields, e.g. ``errors`` or ``conflict``) and
    serialized at the top level alongside the standard fields.
    """

    model_config = ConfigDict(extra="allow")

    type: str = DEFAULT_PROBLEM_TYPE
    title: str
    status: int
    # Always present so legacy clients that read ``body.detail`` keep working.
    detail: str
    instance: str | None = None

    def to_dict(self) -> dict[str, Any]:
        # ``None`` instance is omitted (it is optional in RFC 9457) but the
        # three load-bearing fields -- type, title, status -- and detail are
        # always emitted. Extension members flow through ``extra="allow"``.
        data = self.model_dump(exclude_none=True)
        # ``detail`` may legitimately be an empty string; keep it regardless so
        # the legacy contract ("body always has a detail key") never breaks.
        data.setdefault("detail", self.detail)
        return data


def _title_for_status(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


def problem_response(
    status: int,
    detail: str,
    *,
    title: str | None = None,
    type_: str = DEFAULT_PROBLEM_TYPE,
    instance: str | None = None,
    headers: dict[str, str] | None = None,
    **extensions: Any,
) -> JSONResponse:
    """Build a ``problem+json`` :class:`JSONResponse`.

    ``detail`` is mandatory and always echoed at the top level. ``title``
    defaults to the HTTP reason phrase for ``status``. Extra keyword arguments
    become RFC 9457 extension members.
    """

    problem = ProblemDetail(
        type=type_,
        title=title or _title_for_status(status),
        status=status,
        detail=detail,
        instance=instance,
        **extensions,
    )
    return JSONResponse(
        status_code=status,
        content=problem.to_dict(),
        media_type=PROBLEM_CONTENT_TYPE,
        headers=headers,
    )


def problem_from_http_exception(
    exc: Any,
    *,
    instance: str | None = None,
    type_: str = DEFAULT_PROBLEM_TYPE,
) -> JSONResponse:
    """Render a Starlette/FastAPI ``HTTPException`` as ``problem+json``.

    The exception's ``detail`` is coerced to a string for the top-level field;
    when it is a mapping or list it is also attached verbatim under the
    ``errors`` extension so structured detail is not lost.
    """

    status = getattr(exc, "status_code", 500)
    raw_detail = getattr(exc, "detail", None)
    headers = getattr(exc, "headers", None)

    extensions: dict[str, Any] = {}
    if isinstance(raw_detail, str):
        detail = raw_detail
    elif raw_detail is None:
        detail = _title_for_status(status)
    else:
        detail = _title_for_status(status)
        extensions["errors"] = raw_detail

    return problem_response(
        status,
        detail,
        type_=type_,
        instance=instance,
        headers=dict(headers) if headers else None,
        **extensions,
    )


def problem_from_validation_error(
    exc: Any,
    *,
    status: int = 422,
    instance: str | None = None,
    type_: str = DEFAULT_PROBLEM_TYPE,
) -> JSONResponse:
    """Render a FastAPI/pydantic ``RequestValidationError`` as ``problem+json``.

    The per-field errors are attached under the ``errors`` extension and a
    human-readable summary is placed in ``detail``.
    """

    raw_errors = exc.errors() if hasattr(exc, "errors") else []
    # ``errors()`` payloads can contain non-JSON-serializable context (e.g.
    # ValueError instances); coerce the awkward fields to strings.
    errors: list[dict[str, Any]] = []
    for item in raw_errors:
        cleaned = {k: v for k, v in item.items() if k != "ctx"}
        if "ctx" in item:
            cleaned["ctx"] = {k: str(v) for k, v in item["ctx"].items()}
        errors.append(cleaned)

    if errors:
        first = errors[0]
        loc = ".".join(str(part) for part in first.get("loc", ())) or "request"
        detail = f"{loc}: {first.get('msg', 'validation error')}"
    else:
        detail = "request validation failed"

    return problem_response(
        status,
        detail,
        title="Unprocessable Entity",
        type_=type_,
        instance=instance,
        errors=errors,
    )
