from __future__ import annotations

import importlib


def _fresh_cli(server_modules):
    """Reload the server modules against the test sqlite db, then reload ``cli``
    so its module-level ``SessionLocal`` / ``run_migrations`` bind to that db."""
    server_modules()
    from worldmodel_server import cli

    return importlib.reload(cli)


def _run(cli, monkeypatch, *argv):
    monkeypatch.setattr("sys.argv", ["worldmodel-server-admin", *argv])
    return cli.main()


def test_cli_create_api_key(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)

    rc = _run(
        cli,
        monkeypatch,
        "create-api-key",
        "--name",
        "ci",
        "--scope",
        "runs:write",
        "--expires-in-days",
        "30",
    )
    out = capsys.readouterr().out

    assert rc == 0
    assert "Created API key 'ci'" in out
    assert "Secret: wmg_" in out
    assert "Expires:" in out
    assert "never" not in out  # an expiry was set


def test_cli_create_without_expiry_says_never(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)

    rc = _run(cli, monkeypatch, "create-api-key", "--name", "perm", "--scope", "admin")
    out = capsys.readouterr().out

    assert rc == 0
    assert "Expires: never" in out


def test_cli_rotate_api_key(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)

    _run(cli, monkeypatch, "create-api-key", "--name", "rot", "--scope", "runs:write")
    created = capsys.readouterr().out
    prefix = next(
        line.split("Prefix: ", 1)[1].strip()
        for line in created.splitlines()
        if line.startswith("Prefix: ")
    )

    rc = _run(cli, monkeypatch, "rotate-api-key", "--prefix", prefix, "--expires-in-days", "10")
    out = capsys.readouterr().out

    assert rc == 0
    assert "Rotated API key 'rot'" in out
    assert f"Old prefix (deactivated): {prefix}" in out

    # The old key is now inactive in the database.
    with cli.SessionLocal() as session:
        old = cli.find_api_key_by_prefix(session, prefix)
        assert old.is_active is False


def test_cli_rotate_missing_prefix_returns_1(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)
    cli.run_migrations()

    rc = _run(cli, monkeypatch, "rotate-api-key", "--prefix", "wmg_nope")
    out = capsys.readouterr().out

    assert rc == 1
    assert "No API key found" in out


def test_cli_revoke_api_key(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)

    _run(cli, monkeypatch, "create-api-key", "--name", "rev", "--scope", "runs:write")
    created = capsys.readouterr().out
    prefix = next(
        line.split("Prefix: ", 1)[1].strip()
        for line in created.splitlines()
        if line.startswith("Prefix: ")
    )

    rc = _run(cli, monkeypatch, "revoke-api-key", "--prefix", prefix)
    out = capsys.readouterr().out

    assert rc == 0
    assert "Revoked API key 'rev'" in out

    with cli.SessionLocal() as session:
        item = cli.find_api_key_by_prefix(session, prefix)
        assert item.is_active is False


def test_cli_revoke_missing_prefix_returns_1(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)
    cli.run_migrations()

    rc = _run(cli, monkeypatch, "revoke-api-key", "--prefix", "wmg_absent")
    out = capsys.readouterr().out

    assert rc == 1
    assert "No API key found" in out


def test_cli_list_api_keys_empty(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)
    cli.run_migrations()

    rc = _run(cli, monkeypatch, "list-api-keys")
    out = capsys.readouterr().out

    assert rc == 0
    assert "No API keys." in out


def test_cli_list_api_keys_reports_statuses(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)
    cli.run_migrations()

    from datetime import timedelta

    from worldmodel_server.models import utcnow

    with cli.SessionLocal() as session:
        cli.create_api_key(session, name="live", scopes=["runs:write"])
        cli.create_api_key(
            session,
            name="dead",
            scopes=["runs:write"],
            expires_at=utcnow() - timedelta(days=1),
        )
        revoked, _ = cli.create_api_key(session, name="gone", scopes=["admin"])
        cli.revoke_api_key(session, revoked)

    rc = _run(cli, monkeypatch, "list-api-keys")
    out = capsys.readouterr().out

    assert rc == 0
    assert "status=active" in out
    assert "status=expired" in out
    assert "status=revoked" in out


def test_cli_migrate(server_modules, monkeypatch, capsys):
    cli = _fresh_cli(server_modules)

    rc = _run(cli, monkeypatch, "migrate")
    out = capsys.readouterr().out

    assert rc == 0
    assert "Database migrations applied." in out
