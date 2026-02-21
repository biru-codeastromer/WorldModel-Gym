from __future__ import annotations

from typing import Any, Protocol


class WorldModel(Protocol):
    def init_state(self, batch_size: int = 1) -> Any:
        """Initialize latent/belief state for a batch."""

    def observe(self, prev_state: Any, obs) -> Any:
        """Update latent state given new observation."""

    def predict(self, state: Any, action: int):
        """Predict one step into the future.

        Returns: (next_state, pred_obs, pred_reward, pred_done, aux)
        """

    def imagine_rollout(self, state: Any, action_seq):
        """Predict a trajectory and uncertainty, if available."""
