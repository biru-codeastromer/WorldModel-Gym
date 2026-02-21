# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]
- Pending release metadata and follow-up benchmark extensions.

## [0.1.0] - 2026-02-21
### Added
- Monorepo scaffold with Python packages for `core`, `agents`, `planners`, `worldmodels`, and `server`.
- Three procedural long-horizon environments: MemoryMaze, SwitchQuest, and CraftLite.
- Stable episode trace schema, deterministic evaluation harness, CLI runner, and continual track metrics.
- Planner implementations: MCTS, MPC-CEM, and trajectory sampling baselines.
- World model baselines: deterministic latent, stochastic latent, and ensemble uncertainty wrapper.
- Agent baselines: random, oracle, planner-oracle, imagination MPC, search MCTS skeleton, and PPO placeholder.
- FastAPI server with runs CRUD, artifact uploads, leaderboard queries, tasks listing, and trace/metrics downloads.
- Next.js dashboard with pages for home/tasks/leaderboard/run viewer.
- Expo mobile viewer for task, leaderboard, and run summary browsing.
- Docker compose stack, demo upload script, CI workflow, and pre-commit tooling.
- Paper artifacts: imported draft PDF, LaTeX manuscript recreation, BibTeX references, and build workflow.
