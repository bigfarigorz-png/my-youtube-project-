# quiet-hours-pipeline

An automated, **human-in-the-loop** content pipeline for a faceless sleep /
affirmations YouTube channel. It generates ideas, a script, music, visuals, and
a finished `final.mp4`, then uploads to YouTube **as private** — with two
**mandatory approval gates** you can drive from your phone via Telegram.

> ⚠️ **Nothing is ever auto-published publicly.** Uploads are `private` by
> default, and the code refuses `public`. The two approval pauses cannot be
> skipped: you either tap a Telegram button or type a confirmation word in the
> terminal.

---

## How it works

```
1. ideas      Claude proposes 8 ideas        ──► PAUSE: you pick one (Telegram 1-8 / CLI)
2. script     Claude writes script + prompts ──► PAUSE: you must "approve" (or "reject")
3. audio      MusicGPT bed + your/AI voice, mixed & looped with ffmpeg
4. visuals    Higgsfield clip + 1280x720 thumbnail
5. assemble   ffmpeg loops the clip to the audio length → final.mp4 (H.264/AAC)
6. review     final.mp4 sent to Telegram      ──► PAUSE: you must "upload" (or "cancel")
7. upload     YouTube Data API v3 → PRIVATE, then prints the URL
```

Telegram also pings you at every step (`✅ Audio done`, …) and on any error
(`❌ Error in <step>: …`). If Telegram is unreachable, every gate falls back to a
**required** terminal confirmation — it never auto-proceeds.

---

## Project layout

```
quiet-hours-pipeline/
├── config/settings.py   # loads .env; no hardcoded secrets
├── ideas.py             # Anthropic Messages API: 8 ideas + full package
├── audio.py             # MusicGPT (MusicAI + TextToSpeech) + ffmpeg mixing/looping
├── visuals.py           # Higgsfield clip + thumbnail (Segmind REST or official CLI)
├── assemble.py          # ffmpeg: loop clip to audio length, mux → final.mp4
├── upload.py            # YouTube Data API v3, OAuth2, private upload + thumbnail
├── notify.py            # Telegram: messages, buttons, file delivery, remote approval
├── main.py              # CLI orchestrator with the two mandatory approval gates
├── util.py              # logging, retry/backoff, downloads, ffmpeg helpers
├── input/voiceover.mp3  # (you provide, MODE_OWN_VOICE)
└── output/<slug>/       # script.json, bed.mp3, audio_final.mp3, clip, thumbnail, final.mp4
```

---

## Prerequisites

- **Python 3.10+**
- **ffmpeg** (and `ffprobe`) on your PATH:
  - macOS: `brew install ffmpeg`
  - Debian/Ubuntu: `sudo apt update && sudo apt install -y ffmpeg`
  - Windows: `choco install ffmpeg` (or `winget install Gyan.FFmpeg`)
  - Verify: `ffmpeg -version`

---

## Install

```bash
git clone <your-fork-url> quiet-hours-pipeline
cd quiet-hours-pipeline
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # then edit .env (see below)
```

---

## Getting each API key

### 1. Anthropic (`ANTHROPIC_API_KEY`)
1. Sign in at <https://console.anthropic.com>.
2. **API keys → Create key**, copy it into `.env`.
3. The pipeline uses `claude-opus-4-8` (latest model — see docs.claude.com).

### 2. MusicGPT (`MUSICGPT_API_KEY`)
1. Sign in at <https://musicgpt.com> and open the API/developer dashboard.
2. Create an API key and paste it into `.env`. It is sent as the raw
   `Authorization` header (no `Bearer`).
3. *(Optional)* If you have a public HTTPS endpoint, set `MUSICGPT_WEBHOOK_URL`.
   Otherwise the pipeline **polls** the status endpoint — fine for local runs.

### 3. Visuals — Higgsfield
You can use either backend (set `VISUALS_BACKEND`):

- **Segmind (default, fully headless)** — set `SEGMIND_API_KEY`.
  1. Sign in at <https://www.segmind.com>, create an API key (`x-api-key`).
  2. Open the Higgsfield model explorer and pick:
     - an **image2video motion** preset → `HIGGSFIELD_MOTION_ID`
     - a **text2image-soul style** → `HIGGSFIELD_STYLE_ID`
- **Official Higgsfield (OAuth, credit-based)** — `VISUALS_BACKEND=higgsfield`.
  Install/auth the skill: `npx skills add higgsfield-ai/skills`. This backend is
  driven through Higgsfield's CLI/MCP; for fully automated runs use Segmind.

### 4. YouTube Data API v3 (`YOUTUBE_CLIENT_SECRET`)
1. Go to <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → Library →** enable **“YouTube Data API v3”**.
3. **APIs & Services → OAuth consent screen:** choose **External**, fill the
   basics, and add **your own Google account as a Test user**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Application type: Desktop app.** Download the JSON.
5. Save it in the project (e.g. `client_secret.json`) and point
   `YOUTUBE_CLIENT_SECRET` at its path.
6. On the first upload a browser opens for consent; the token is then cached in
   `token.json` (git-ignored).

### 5. Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)
1. In Telegram, message **@BotFather** → `/newbot` → follow prompts → copy the
   **token** into `TELEGRAM_BOT_TOKEN`.
2. Send your new bot any message (say “hi”).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and read
   `result[].message.chat.id`. Put that number in `TELEGRAM_CHAT_ID`.
4. Telegram is **optional** — if these are blank the pipeline uses CLI prompts.

---

## Configure & run

1. Fill in `.env` (see `.env.example` for every key).
2. Choose the audio mode in `.env`:
   - `AUDIO_MODE=MODE_OWN_VOICE` → record your narration and save it as
     `input/voiceover.mp3`.
   - `AUDIO_MODE=MODE_FULL_AUTO` → narration is generated by MusicGPT TTS.
3. Run it:

```bash
python main.py
```

You'll be walked through the 7 steps. At the two gates, tap the Telegram button
(**approve/reject**, then **upload/cancel**) or type the word in the terminal.

---

## The approval gates (why they're safe)

- **Gate 1 (after the script):** requires `approve`. `reject` stops the run.
- **Gate 2 (after assembly):** requires `upload`. `cancel` keeps `final.mp4`
  local and uploads nothing.
- There is **no flag to bypass** a gate. If Telegram is configured it's used;
  if it times out or is unreachable, the terminal demands the exact word. With
  no interactive terminal (e.g. piped stdin), the gate resolves to **stop**, not
  proceed.
- Uploads are always `private`; `public` raises an error.

---

## Notes & limitations

- **API formats** were confirmed against each provider's official docs
  (docs.musicgpt.com, segmind.com, core.telegram.org, docs.claude.com) before
  the calls were written.
- **MusicGPT** returns two variants and is asynchronous; the pipeline polls
  `GET /api/public/v1/byId?conversionType=MUSIC_AI&...` until `status=COMPLETED`.
  Very long scripts may exceed TTS limits in `MODE_FULL_AUTO` — `MODE_OWN_VOICE`
  is the most reliable for long-form sleep content.
- **Higgsfield clips are short (~3–15s)** — `assemble.py` loops the clip across
  the full audio length. `visuals.loop_video_to_duration(..., seamless=True)`
  offers a boomerang loop if you want a standalone seamless clip.
- **Looping** a sleep *story* repeats the narration to reach the target length;
  for affirmation loops that's expected. Adjust `TARGET_LENGTH_SECONDS` to taste.
- Generated files land in `output/<slug>/`; secrets stay in `.env` (git-ignored).
