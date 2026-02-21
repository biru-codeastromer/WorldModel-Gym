VENV ?= .venv
PYTHON ?= $(VENV)/bin/python
PIP ?= $(VENV)/bin/pip

.PHONY: setup test lint demo paper deploy stop

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

demo:
	@if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then \
		docker compose up -d --build; \
	else \
		echo "Docker daemon unavailable; starting local API fallback on :8000"; \
		mkdir -p .tmp; \
		$(PYTHON) -m uvicorn worldmodel_server.main:app --host 127.0.0.1 --port 8000 > .tmp/demo-server.log 2>&1 & \
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
