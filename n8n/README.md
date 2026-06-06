# Running quiet-hours-pipeline from n8n (Cloud)

n8n **Cloud has no shell**, so it can't run ffmpeg or import the Python modules
directly. This folder gives you a split setup:

- **n8n = control panel.** Telegram approval gates, step notifications, and
  orchestration. Import `quiet-hours-pipeline.n8n.json`.
- **`render_service.py` = engine.** A tiny FastAPI app (in the repo root) that
  wraps the tested `ideas / audio / visuals / assemble / upload` modules behind
  HTTP endpoints. n8n calls it over HTTP.

```
 n8n Cloud workflow ──HTTP──► render_service.py ──► Claude / MusicGPT / Segmind / ffmpeg / YouTube
        │  (Telegram approvals + notifications)            (runs where ffmpeg + .env live)
```

You host `render_service.py` somewhere n8n Cloud can reach (a tunnel from your
machine, or a small VPS). It is the same code from the CLI pipeline — n8n just
drives it and adds the human approval UX.

---

## 1. Start the engine

On a machine that has **ffmpeg** and your filled-in **`.env`** (see the main
[README](../README.md) for every key, and authorize YouTube once by running
`python main.py` so a `token.json` exists):

```bash
pip install -r requirements.txt -r n8n/requirements.txt

export RENDER_API_TOKEN=$(python -c "import secrets;print(secrets.token_hex(16))")
export PUBLIC_BASE_URL=https://your-public-url     # the URL n8n + Telegram will use
uvicorn render_service:app --host 0.0.0.0 --port 8000
```

Make it reachable from n8n Cloud — e.g. a quick tunnel:

```bash
ngrok http 8000          # then PUBLIC_BASE_URL = the https URL ngrok prints
# (restart uvicorn with that PUBLIC_BASE_URL so file links point at the tunnel)
```

Endpoints (all require header `X-API-Token: $RENDER_API_TOKEN`):
`/ideas` · `/script` · `/audio` · `/visuals` · `/assemble` · `/upload`, plus
`/files/<slug>/<name>` for the generated thumbnail/video, and `/health`.

---

## 2. Import the workflow

1. n8n → **Workflows → Import from File** → `quiet-hours-pipeline.n8n.json`
   (or open the file, copy its contents, and paste onto the canvas).
2. Open the **Config** node and set:
   - `baseUrl` → your `PUBLIC_BASE_URL` (e.g. the ngrok https URL)
   - `apiToken` → the `RENDER_API_TOKEN` you exported
   - `chatId` → your Telegram chat id
3. Create a **Telegram** credential (Bot token from @BotFather) and select it on
   every Telegram node (they share one credential).
4. *(Recommended)* Settings → **Error Workflow** → select this workflow, so the
   `On Error` trigger fires the `❌` Telegram message on any failure.
5. **Save**, then **Test workflow**.

---

## Flow

```
Start → Config → 🟢 start notice → /ideas → send list → ⏸ pick 1-8 (reply)
      → /script → preview → ⏸ Approve/Reject ──reject──► 🛑 stop
      → /audio → ✅ → /visuals → ✅ → /assemble → ✅
      → send thumbnail + link → ⏸ Upload/Cancel ──cancel──► 🛑 stop
      → /upload (PRIVATE) → 📤 link
```

The two ⏸ approvals use the Telegram node's **Send and Wait for Response**, which
pauses the execution until you tap a button (or reply) — the remote approval
gate, now driven by n8n.

---

## Post-import checklist & notes

- **Credentials never import.** You must attach the Telegram credential and fill
  the Config node yourself (steps 2–3 above).
- **Verify the Telegram nodes** after import. `Send and Wait for Response` and
  `sendPhoto` parameter shapes vary slightly by n8n version; if a node shows a
  warning, re-pick the operation. Requires a recent n8n (Telegram node with
  "Send and Wait for Response").
- **Big finals don't fit Telegram.** Telegram bots cap file sends well below a
  30-minute video, so the workflow sends the **thumbnail + a link** to
  `final_url` (served by the engine) rather than the whole `final.mp4`. Open the
  link to watch/download.
- **YouTube auth is interactive.** The headless `/upload` endpoint needs an
  existing `token.json` — run `python main.py` once locally to complete the
  browser consent, then the service reuses the token.
- **Long steps.** `/audio` (MusicGPT polling) and `/assemble` (ffmpeg) can take
  minutes; the HTTP nodes use a 30-minute timeout.
- **Approval gates stay mandatory.** `reject`/`cancel` end the run; nothing is
  ever uploaded without an explicit tap, and uploads are always `private`.
- **Prefer self-hosted?** If you move to self-hosted n8n you can replace the HTTP
  calls with **Execute Command** nodes that run the modules directly — tell me
  and I'll generate that variant.
