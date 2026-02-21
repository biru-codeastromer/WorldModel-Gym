# worldmodel-gym

WorldModel Gym is a reproducible long-horizon planning benchmark + evaluation platform for imagination-based agents.

## Quickstart (30 seconds)

```bash
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
make deploy-fly
```
