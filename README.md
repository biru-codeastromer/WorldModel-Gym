# worldmodel-gym

WorldModel Gym is a reproducible long-horizon planning benchmark + evaluation platform for imagination-based agents.

## Quickstart (30 seconds)

```bash
cp .env.example .env
make setup
make demo
```

`make demo` will:
- start the API + web stack with Docker when available
- fall back to local API execution when Docker daemon is unavailable
- run one benchmark evaluation
- upload artifacts and populate leaderboard data

Open:
- [http://localhost:3000](http://localhost:3000) (web dashboard)
- [http://localhost:8000/docs](http://localhost:8000/docs) (FastAPI docs)

## Production-ready defaults

- CI runs Ruff, pytest, and a Next.js production build on every PR via GitHub Actions.
- The API validates `run_id` values before writing artifacts to disk, which blocks path traversal bugs.
- Production mode requires a non-default upload token via `WMG_ENV=production`.
- Docker images start the API and web dashboard in production mode rather than development mode.

## Environment

Copy `.env.example` and adjust values for your machine or deployment target:

```bash
cp .env.example .env
```

Important variables:
- `WMG_ENV`: use `development` locally and `production` in hosted environments
- `WMG_UPLOAD_TOKEN`: required for artifact uploads; must be changed in production
- `WMG_CORS_ORIGINS`: comma-separated allowed web origins for the API
- `NEXT_PUBLIC_API_BASE`: public URL for the FastAPI service consumed by the web app
- `INTERNAL_API_BASE`: optional server-side API base for Docker or reverse-proxy setups

## Run a single evaluation

```bash
.venv/bin/python -m worldmodel_gym.eval.run \
  --agent random \
  --env memory_maze \
  --track test \
  --seeds 211,223 \
  --max-episodes 2
```

Artifacts are written to `runs/<run_id>/`:
- `metrics.json`
- `trace.jsonl`
- `config.yaml`

## Monorepo layout

- `core/`: environments, traces, eval harness
- `planners/`: MCTS, MPC-CEM, trajectory sampling
- `worldmodels/`: deterministic/stochastic/ensemble latent models
- `agents/`: baseline agents and registry
- `server/`: FastAPI leaderboard + run artifact service
- `web/`: Next.js dashboard
- `mobile/`: Expo viewer
- `paper/`: draft PDF + LaTeX sources

## Dev targets

```bash
make lint
make test
make paper
make deploy
make stop
make deploy-public
make stop-public
make deploy-vercel
```

## Free Cloud Deploy

- API: deploy `render.yaml` on Render Blueprint (free web service).
- Web: deploy `web/` on Vercel Hobby with `NEXT_PUBLIC_API_BASE` set to the Render API URL.
- Full steps: `docs/DEPLOYMENT.md`.

## Resume-friendly highlights

- Reproducible benchmark platform for long-horizon planning and imagination-based agents
- Monorepo spanning benchmark environments, planners, world models, FastAPI backend, Next.js dashboard, and Expo mobile client
- Automated quality gates with linting, tests, and web production builds
- Cloud-ready deployment path for Render + Vercel plus local Docker-based operation
