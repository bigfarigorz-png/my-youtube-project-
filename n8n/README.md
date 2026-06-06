# Running quiet-hours-pipeline from n8n (Cloud)

n8n **Cloud has no shell**, so it can't run ffmpeg or import the Python modules
directly. This folder gives you a split setup:

- **n8n = control panel.** Telegram approval gates + notifications + orchestration.
  Import `quiet-hours-pipeline.n8n.json`.
- **`render_service.py` = engine.** A tiny FastAPI app (in the repo root) that
  wraps the tested `ideas / audio / visuals / assemble / upload` modules behind
  HTTP endpoints. n8n calls it over HTTP.

```
 n8n Cloud workflow ──HTTP──► render_service.py ──► Claude / MusicGPT / Segmind / ffmpeg / YouTube
        │  (Telegram approvals + notifications)            (runs where ffmpeg + .env live)
```

**Telegram is done with plain HTTP Request nodes** to `https://api.telegram.org/bot<token>/…`
— there is **no Telegram credential to set up**. The approval buttons are URL
buttons that resume the workflow through n8n's **Wait** node.

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

Make it reachable from n8n Cloud — e.g. `ngrok http 8000`, then use the printed
https URL as `PUBLIC_BASE_URL` (restart uvicorn with it set).

---

## 2. Import the workflow

1. n8n → **Workflows → Import from File** → `quiet-hours-pipeline.n8n.json`
   (or open the file, copy all, and paste onto the canvas).
2. Open the **Config** node and set the four values:
   | field      | value |
   |------------|-------|
   | `botBase`  | `https://api.telegram.org/bot<YOUR_BOT_TOKEN>` |
   | `chatId`   | your Telegram chat id (see below) |
   | `baseUrl`  | your `PUBLIC_BASE_URL` (the engine's public URL) |
   | `apiToken` | the `RENDER_API_TOKEN` you exported |
3. **Save**, then **Test workflow**.

**Getting your `chatId`:** message your bot once (say "hi"), then open
`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` and read
`result[].message.chat.id`.

---

## Flow

```
Start → Config → 🟢 start → /ideas → list + buttons 1-8 → ⏸ tap a number
      → /script → preview → ⏸ tap approve / reject ──reject──► 🛑 stop
      → /audio → ✅ → /visuals → ✅ → /assemble → ✅
      → thumbnail + link → ⏸ tap upload / cancel ──cancel──► 🛑 stop
      → /upload (PRIVATE) → 📤 link
```

**How the buttons work:** each approval message has inline **URL buttons**
pointing at the workflow's Wait-node resume URL (e.g. `…?action=approve`).
Tapping one opens a short browser tab and resumes the run with that choice — so
nothing proceeds without an explicit tap. (You can close the tab afterwards.)

---

## Notes

- **Big finals don't fit Telegram.** Bots can't send a 30-minute video, so the
  workflow sends the **thumbnail + a link** to `final_url` (served by the engine)
  instead of the whole file. Open the link to watch/download.
- **YouTube auth is interactive.** The headless `/upload` endpoint needs an
  existing `token.json` — run `python main.py` once locally to complete the
  browser consent, then the service reuses the token.
- **Long steps.** `/audio` (MusicGPT polling) and `/assemble` (ffmpeg) can take
  minutes; the service HTTP nodes use a 30-minute timeout.
- **Approval gates stay mandatory.** `reject` / `cancel` end the run; nothing is
  ever uploaded without a tap, and uploads are always `private`.
- **Keep your bot token private.** It lives in the Config node of your imported
  workflow. The copy committed to the repo uses a `<YOUR_TELEGRAM_BOT_TOKEN>`
  placeholder; never commit the real one. Rotate via @BotFather → /revoke if it
  ever leaks.
- **Prefer self-hosted n8n?** You can replace the `/…` HTTP calls with **Execute
  Command** nodes that run the modules directly — ask and I'll generate that.
