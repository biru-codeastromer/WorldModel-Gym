# worldmodel-gym

WorldModel Gym is a long-horizon planning benchmark for imagination-based agents.

## 30-second demo

```bash
make setup
make demo
```

Then open:

- Web UI: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>

## Run one evaluation

```bash
python -m worldmodel_gym.eval.run --agent random --env memory_maze --track test --seeds 101,102 --max-episodes 2
```

Artifacts are written to `runs/<run_id>/`.

## Developer targets

```bash
make lint
make test
make paper
```
