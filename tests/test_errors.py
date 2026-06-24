from __future__ import annotations

import json

from fastapi import HTTPException
from worldmodel_server.errors import (
    PROBLEM_CONTENT_TYPE,
    ProblemDetail,
    problem_from_http_exception,
    problem_from_validation_error,
    problem_response,
)


def _body(response) -> dict:
    return json.loads(bytes(response.body))


def test_problem_response_has_problem_json_media_type_and_detail():
    resp = problem_response(404, "run not found")
    assert resp.status_code == 404
    assert resp.media_type == PROBLEM_CONTENT_TYPE
    body = _body(resp)
    # Legacy contract: a top-level detail string is always present.
    assert body["detail"] == "run not found"
    assert body["type"] == "about:blank"
    assert body["title"] == "Not Found"
    assert body["status"] == 404


def test_problem_response_carries_extensions_and_instance():
    resp = problem_response(
        409,
        "idempotency key reused",
        instance="/api/runs",
        conflict=True,
    )
    body = _body(resp)
    assert body["instance"] == "/api/runs"
    assert body["conflict"] is True


def test_problem_response_emits_empty_detail_key():
    # detail may be empty but the key must still be present for legacy clients.
    body = _body(problem_response(500, ""))
    assert "detail" in body
    assert body["detail"] == ""


def test_problem_detail_to_dict_omits_none_instance():
    data = ProblemDetail(title="x", status=400, detail="bad").to_dict()
    assert "instance" not in data
    assert data["detail"] == "bad"


def test_http_exception_string_detail_preserved():
    resp = problem_from_http_exception(HTTPException(status_code=403, detail="forbidden"))
    body = _body(resp)
    assert resp.status_code == 403
    assert body["detail"] == "forbidden"


def test_http_exception_structured_detail_attached_under_errors():
    exc = HTTPException(status_code=400, detail={"field": "env", "msg": "missing"})
    resp = problem_from_http_exception(exc)
    body = _body(resp)
    # Top-level detail falls back to the reason phrase...
    assert body["detail"] == "Bad Request"
    # ...and the structured detail is preserved under the errors extension.
    assert body["errors"] == {"field": "env", "msg": "missing"}


def test_http_exception_headers_propagated():
    exc = HTTPException(
        status_code=429,
        detail="slow down",
        headers={"Retry-After": "30"},
    )
    resp = problem_from_http_exception(exc)
    assert resp.headers["Retry-After"] == "30"


class _FakeValidationError:
    def errors(self):
        return [
            {
                "loc": ("body", "success_rate"),
                "msg": "field required",
                "type": "missing",
                "ctx": {"reason": ValueError("boom")},
            }
        ]


def test_validation_error_summary_and_errors_extension():
    resp = problem_from_validation_error(_FakeValidationError())
    body = _body(resp)
    assert resp.status_code == 422
    assert resp.media_type == PROBLEM_CONTENT_TYPE
    assert body["detail"] == "body.success_rate: field required"
    assert body["errors"][0]["loc"] == ["body", "success_rate"]
    # ctx is stringified so it stays JSON-serializable.
    assert body["errors"][0]["ctx"]["reason"] == "boom"


def test_validation_error_with_no_errors_falls_back():
    class _Empty:
        def errors(self):
            return []

    body = _body(problem_from_validation_error(_Empty()))
    assert body["detail"] == "request validation failed"
