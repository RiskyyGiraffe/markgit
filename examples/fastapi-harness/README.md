# Observable FastAPI harness

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8001
```

In another terminal:

```bash
markgit harness onboard markgit-harness.json
markgit harness run observable-example-loop --input '{"goal":"verify shared monitoring"}' --yes
markgit harness monitor RUN_ID --follow
```

The provider runs locally. Markgit stores the run identity, frozen access and pricing snapshots, compaction count, and append-only events.
