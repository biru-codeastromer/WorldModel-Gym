# Security Policy

## Supported Versions

The latest `main` branch is the supported production path for this project.

## Reporting a Vulnerability

Please use GitHub private security advisories for sensitive reports:

- Open: `Security` -> `Advisories` -> `Report a vulnerability`
- Or use the private advisory link configured in the issue template settings

Please avoid opening public issues for credential leaks, auth bypasses, or storage vulnerabilities.

## Hardening Notes

- Write APIs support scoped API keys and a legacy upload token compatibility path.
- Upload size limits and run ID validation are enforced server-side.
- Database schema changes run through Alembic migrations instead of implicit table creation.
- Public browser traffic reaches the backend through the Next.js proxy route, reducing direct cross-origin exposure.
