# Benchmark Specs

## Tracks
- `train`: procedural train seeds
- `test`: held-out procedural test seeds
- `continual`: nonstationary dynamics shifts every N episodes

## Seed Protocol
- Seed suites are fixed in `core/worldmodel_gym/eval/seeds.py`.
- Train metrics use train seeds only.
- Test metrics use held-out test seeds only.
- Generalization gap is `train_success_rate - test_success_rate`.

## Core Metrics
- `success_rate`
- `mean_return`
- `median_steps_to_success`
- `achievement_completion`
- `planning_cost` (`wall_clock_ms_per_step`, `imagined_transitions`, `peak_memory_mb`)
- `model_fidelity` (k-step reward error for k in 1,5,10)
- `generalization_gap` (train vs test)

## Continual Track
- Shift schedule is implemented in `core/worldmodel_gym/eval/continual.py`.
- Default schedule shifts difficulty every 5 episodes.
- Reported metrics:
  - `forward_transfer = last_phase_score - first_phase_score`
  - `backward_transfer = mean(scores_after_phase0) - phase0_score`
  - `forgetting = max_phase_score - last_phase_score`

## Seeds
- Train and test seeds are fixed per environment in code (`core/worldmodel_gym/eval/seeds.py`).
