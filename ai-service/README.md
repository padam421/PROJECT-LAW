# Nyay Setu — AI Service

Python microservice reserved for the client-facing AI features:
legal-assistant chat, lawyer matching and the virtual court simulator.

## Current status (honest)

| Module | State |
|---|---|
| `src/app.py` | Flask skeleton — placeholder routes only |
| `src/inference/*` | Empty placeholders, not implemented |
| `src/nlp/*` | Empty placeholders, not implemented |
| `src/training/*` | Empty placeholders, not implemented |

**No model training, inference or RAG is implemented yet.** The
lawyer-side platform does **not** depend on this service: all "AI case
insights" shown in the advocate portal are transparent rule-based
heuristics computed inside the frontend (`case_analysis.js`,
`dashboard.js`) and are labelled as preliminary in the UI.

## Planned contract

- `POST /api/ai/chat` — legal assistant conversation
- `POST /api/ai/court` — virtual court simulation turns
- `POST /api/ai/match` — lawyer matching for client intake

The backend integration point is `AI_SERVICE_URL` in `.env`.

## Run

```bash
pip install -r requirements.txt
python src/app.py   # serves on :5000
```

`pytest.ini` is ready for when tests are added.
