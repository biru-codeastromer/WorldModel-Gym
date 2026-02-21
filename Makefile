PYTHON ?= python3
PIP ?= pip3

.PHONY: setup test lint demo paper

setup:
	$(PIP) install -r requirements-dev.txt
	$(PIP) install -e core -e planners -e worldmodels -e agents -e server
	cd web && npm install
	cd mobile && npm install

test:
	pytest

lint:
	ruff check .
	ruff format --check .

demo:
	docker compose up -d --build
	$(PYTHON) scripts/demo_run.py

paper:
	$(MAKE) -C paper paper
