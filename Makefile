VENV ?= .venv
PYTHON ?= $(VENV)/bin/python
PIP ?= $(VENV)/bin/pip

.PHONY: setup test lint lock demo paper deploy stop deploy-public stop-public deploy-vercel seed-demo create-api-key verify-deployment

setup:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements-dev.txt
	$(PIP) install -e core -e planners -e worldmodels -e agents -e server
	cd web && npm install
	cd mobile && npm install

test:
	$(PYTHON) -m pytest

lint:
	$(PYTHON) -m ruff check .
	$(PYTHON) -m ruff format --check .

# Regenerate the fully-pinned, hash-pinned supply-chain lockfile (requirements.lock).
# Captures the third-party dependency closure of the five local packages plus dev tools.
# The local packages themselves are editable installs and are NOT hash-pinned.
# Consume with: pip install --require-hashes --no-deps -r requirements.lock
#               pip install --no-deps -e core -e planners -e worldmodels -e agents -e server
lock:
	uv pip compile --generate-hashes --custom-compile-command "make lock" \
		--output-file requirements.lock \
		core/pyproject.toml planners/pyproject.toml worldmodels/pyproject.toml \
		agents/pyproject.toml server/pyproject.toml requirements-dev.txt
	@printf '#\n# Consume (reproducible install):\n#   pip install --require-hashes --no-deps -r requirements.lock\n#   pip install --no-deps -e core -e planners -e worldmodels -e agents -e server\n# Audit:   pip-audit -r requirements.lock\n#\n%s\n' "$$(cat requirements.lock)" > requirements.lock.tmp && mv requirements.lock.tmp requirements.lock

demo:
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		docker compose up -d --build; \
	else \
		echo "Docker daemon unavailable; starting local API fallback on :8000"; \
		mkdir -p .tmp; \
		WMG_LEGACY_UPLOAD_TOKEN_ENABLED=true $(PYTHON) -m uvicorn worldmodel_server.main:app --host 127.0.0.1 --port 8000 > .tmp/demo-server.log 2>&1 & \
		echo $$! > .tmp/demo-server.pid; \
		sleep 2; \
	fi
	$(PYTHON) scripts/demo_run.py
	@if [ -f .tmp/demo-server.pid ]; then \
		kill `cat .tmp/demo-server.pid` || true; \
		rm -f .tmp/demo-server.pid; \
	fi

paper:
	$(MAKE) -C paper paper

deploy:
	./scripts/deploy_local.sh

stop:
	./scripts/stop_local.sh

deploy-public:
	./scripts/deploy_public.sh

stop-public:
	./scripts/stop_public.sh

deploy-vercel:
	./scripts/deploy_vercel.sh

seed-demo:
	$(PYTHON) -m worldmodel_server.cli seed-demo-data --force

create-api-key:
	$(PYTHON) -m worldmodel_server.cli create-api-key --name "$${NAME:-local-writer}" --scope "$${SCOPE:-runs:write}"

verify-deployment:
	$(PYTHON) scripts/verify_deployment.py
