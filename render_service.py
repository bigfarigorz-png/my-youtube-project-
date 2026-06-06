"""HTTP wrapper around the quiet-hours-pipeline modules, for driving from n8n.

Why this exists: n8n Cloud has no shell, so it can neither run ffmpeg nor import
these Python modules directly. This FastAPI service exposes each pipeline stage
as an endpoint; the n8n workflow (n8n/quiet-hours-pipeline.n8n.json) calls them
over HTTP and handles the Telegram approval gates + notifications itself.

Run it where ffmpeg + your .env live, and expose it publicly so n8n Cloud can
reach it (a tunnel like ngrok/cloudflared, or a small VPS):

    pip install -r requirements.txt -r n8n/requirements.txt
    export RENDER_API_TOKEN=$(python -c "import secrets;print(secrets.token_hex(16))")
    export PUBLIC_BASE_URL=https://your-public-url     # how n8n/Telegram reach this service
    uvicorn render_service:app --host 0.0.0.0 --port 8000

Auth: every endpoint requires the header  X-API-Token: <RENDER_API_TOKEN>.
Generated files are served at /files/<slug>/<name> so n8n/Telegram can fetch them.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import assemble
import audio
import ideas
import upload
import visuals
from config.settings import OUTPUT_DIR, settings
from util import ffprobe_duration, get_logger

log = get_logger("render-service")

API_TOKEN = os.getenv("RENDER_API_TOKEN", "")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")

app = FastAPI(title="quiet-hours render service")


def _auth(token: str) -> None:
    if API_TOKEN and token != API_TOKEN:
        raise HTTPException(status_code=401, detail="invalid X-API-Token")


def _load(slug: str) -> dict:
    path = OUTPUT_DIR / slug / "script.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"no script.json for slug '{slug}' — call /script first")
    return json.loads(path.read_text(encoding="utf-8"))


def _file_url(slug: str, name: str) -> str:
    return f"{PUBLIC_BASE_URL}/files/{slug}/{name}"


class IdeaBody(BaseModel):
    idea: dict


class SlugBody(BaseModel):
    slug: str


@app.get("/health")
def health() -> dict:
    return {"ok": True, "audio_mode": settings.audio_mode, "visuals_backend": settings.visuals_backend}


@app.post("/ideas")
def ep_ideas(x_api_token: str = Header(default="")) -> dict:
    """Step 1 — generate 8 ideas."""
    _auth(x_api_token)
    return {"ideas": ideas.generate_ideas(8)}


@app.post("/script")
def ep_script(body: IdeaBody, x_api_token: str = Header(default="")) -> dict:
    """Step 2 — generate the full package; saves output/<slug>/script.json."""
    _auth(x_api_token)
    pkg = ideas.generate_package(body.idea)
    ideas.save_package(pkg)
    return {
        "slug": pkg["slug"],
        "title": pkg["youtube_title"],
        "preview": pkg["narration_script"][:500],
        "music_style": pkg["music_style"],
        "tags": pkg["youtube_tags"],
    }


@app.post("/audio")
def ep_audio(body: SlugBody, x_api_token: str = Header(default="")) -> dict:
    """Step 3 — instrumental bed + (own/AI) narration, mixed and looped."""
    _auth(x_api_token)
    path = audio.generate_audio(_load(body.slug))
    return {"slug": body.slug, "audio_url": _file_url(body.slug, path.name),
            "duration": round(ffprobe_duration(path), 1)}


@app.post("/visuals")
def ep_visuals(body: SlugBody, x_api_token: str = Header(default="")) -> dict:
    """Step 4 — short clip + 1280x720 thumbnail."""
    _auth(x_api_token)
    audio_path = OUTPUT_DIR / body.slug / "audio_final.mp3"
    duration = ffprobe_duration(audio_path) if audio_path.exists() else settings.target_length_seconds
    clip, thumb = visuals.generate_visuals(_load(body.slug), duration)
    return {"slug": body.slug, "clip_url": _file_url(body.slug, clip.name),
            "thumbnail_url": _file_url(body.slug, thumb.name)}


@app.post("/assemble")
def ep_assemble(body: SlugBody, x_api_token: str = Header(default="")) -> dict:
    """Step 5 — loop clip to audio length and mux → final.mp4."""
    _auth(x_api_token)
    base = OUTPUT_DIR / body.slug
    final = assemble.assemble(_load(body.slug), base / "clip_raw.mp4", base / "audio_final.mp3")
    return {"slug": body.slug, "final_url": _file_url(body.slug, final.name),
            "thumbnail_url": _file_url(body.slug, "thumbnail.jpg"),
            "duration": round(ffprobe_duration(final), 1)}


@app.post("/upload")
def ep_upload(body: SlugBody, x_api_token: str = Header(default="")) -> dict:
    """Step 7 — upload as PRIVATE and set the thumbnail. Returns the URL.

    Requires a YouTube token.json to already exist (run `python main.py` once
    locally to complete the browser OAuth, or pre-place token.json) — a headless
    service cannot open the consent browser.
    """
    _auth(x_api_token)
    base = OUTPUT_DIR / body.slug
    if not (Path("token.json").exists()):
        raise HTTPException(status_code=412,
                            detail="No token.json. Authorize YouTube once locally (run main.py), then retry.")
    url = upload.upload(_load(body.slug), base / "final.mp4", base / "thumbnail.jpg", privacy="private")
    return {"slug": body.slug, "video_url": url}


# Serve generated artifacts (so n8n Cloud / Telegram can fetch the thumbnail, etc.)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(OUTPUT_DIR)), name="files")
