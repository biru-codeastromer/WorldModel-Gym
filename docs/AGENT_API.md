# Agent API

Agents must implement:

- `reset(seed: int | None = None) -> None`
- `act(obs, info: dict) -> int`
- `observe(transition: dict) -> None`

Optional debug/planning traces can be exposed through:

- `get_trace() -> dict`

Register custom agents in `agents/worldmodel_agents/registry.py`.
