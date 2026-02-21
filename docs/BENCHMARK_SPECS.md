# Benchmark Specs

## Tracks
- `train`: procedural train seeds
- `test`: held-out procedural test seeds
- `continual`: nonstationary dynamics shifts every N episodes

## Core Metrics
- `success_rate`
- `mean_return`
- `median_steps_to_success`
- `achievement_completion`
- `planning_cost` (`wall_clock_ms_per_step`, `imagined_transitions`, `peak_memory_mb`)
- `model_fidelity` (k-step reward error for k in 1,5,10)
- `generalization_gap` (train vs test)

## Seeds
- Train and test seeds are fixed per environment in code (`core/worldmodel_gym/eval/seeds.py`).
