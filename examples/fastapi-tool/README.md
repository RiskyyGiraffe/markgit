# Local FastAPI tool

This example keeps the tool compute on the publisher's machine. Markgit only lists it, obtains approval, meters the call, and settles the charge.

```bash
cd examples/fastapi-tool
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 3200
```

In a second terminal:

```bash
markgit onboard examples/fastapi-tool/markgit-tool.json
markgit fund 10
markgit limits set --per-call 1 --daily 5 --monthly 20 --rpm 60 --rph 1000
markgit limits tool local-text-analyzer --per-call 0.10 --daily 1 --rpm 10 --rph 100
markgit search "text analyzer"

# Produces a quote but does not charge without approval.
markgit call local-text-analyzer --input '{"text":"hello from markgit"}'

# Approves only if the exact total is at or below $0.06.
markgit call local-text-analyzer --input '{"text":"hello from markgit","uppercase":true}' --max-cost 0.06
markgit earnings
```

The tool price is `$0.0500`, the buyer-visible Markgit fee is `$0.0050`, and the approved total is `$0.0550`. The provider earns `$0.0500` after a successful call.
