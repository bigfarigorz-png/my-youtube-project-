"""Step 4 — short cinematic clip + 1280x720 thumbnail.

Two backends, chosen by the VISUALS_BACKEND env var:

  segmind    (default) — Segmind's hosted Higgsfield endpoints (header: x-api-key):
                POST https://api.segmind.com/v1/higgsfield-image2video
                POST https://api.segmind.com/v1/higgsfield-text2image-soul
             Requires HIGGSFIELD_MOTION_ID + HIGGSFIELD_STYLE_ID (pick from
             Segmind's model explorer). Endpoints verified against segmind.com docs.

  higgsfield — Higgsfield's official, OAuth/credit-based CLI/MCP
             (`npx skills add higgsfield-ai/skills`). Headless API use is not a
             plain REST call, so this backend shells out to a `higgsfield` CLI if
             present and otherwise raises with guidance.

Higgsfield video clips are short (~3-15s), so we loop the clip to the full audio
length. The actual loop+mux to final.mp4 happens in assemble.py (single pass);
``loop_video_to_duration`` here is provided for standalone use.
"""
from __future__ import annotations

import base64
import binascii
import os
import random
import shutil
import subprocess
from pathlib import Path

import requests

from config.settings import OUTPUT_DIR, require, settings
from util import download, ffprobe_duration, get_logger, retry, run_ffmpeg

log = get_logger("visuals")

SEG_BASE = "https://api.segmind.com/v1"
_URL_KEYS = ("video_url", "video", "output_url", "output", "url", "image_url", "image", "media_url")
_B64_KEYS = ("image", "video", "output", "b64", "base64", "data")


def _seg_headers() -> dict:
    return {"x-api-key": require("SEGMIND_API_KEY"), "Content-Type": "application/json"}


@retry(times=4, exceptions=(requests.RequestException,))
def _seg_post(model: str, payload: dict) -> requests.Response:
    resp = requests.post(f"{SEG_BASE}/{model}", json=payload, headers=_seg_headers(), timeout=300)
    if resp.status_code >= 400:
        raise requests.RequestException(f"{model} -> {resp.status_code}: {resp.text[:300]}")
    return resp


def _first(d: dict, keys) -> str | None:
    """First non-empty string value among keys (recursing once into 'data')."""
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v:
            return v
    if isinstance(d.get("data"), dict):
        return _first(d["data"], keys)
    return None


def _looks_like_url(value: str | None) -> bool:
    return isinstance(value, str) and (value.startswith("http://") or value.startswith("https://"))


def _save_media_response(resp: requests.Response, dest: Path) -> Path:
    """Persist a Segmind media response: binary body, or JSON with a URL / base64.

    Some keys (e.g. ``image``) can carry either a URL or raw base64, so we
    disambiguate by value: a real URL starts with http(s), otherwise we treat a
    long non-URL string as base64.
    """
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    ctype = resp.headers.get("Content-Type", "")
    if "application/json" in ctype:
        data = resp.json()
        value = _first(data, _URL_KEYS) or _first(data, _B64_KEYS)
        if _looks_like_url(value):
            return download(value, dest)
        if value and value.startswith("data:"):  # data URI -> keep only the payload
            value = value.split(",", 1)[-1]
        if value and len(value) > 64:  # treat a long non-URL string as base64
            try:
                dest.write_bytes(base64.b64decode(value))
                return dest
            except (binascii.Error, ValueError):
                pass
        raise RuntimeError(
            "Segmind returned JSON without a media URL or base64 payload — the endpoint "
            f"may be asynchronous. Response head: {str(data)[:200]}"
        )
    dest.write_bytes(resp.content)
    return dest


# --- Segmind backend ------------------------------------------------------

def _segmind_clip(visual_prompt: str, dest: Path) -> Path:
    payload = {
        "model": os.getenv("HIGGSFIELD_MODEL", "dop-preview"),
        "prompt": visual_prompt,
        "seed": random.randint(1, 1_000_000),
        "motion_id": require("HIGGSFIELD_MOTION_ID"),
        "motion_strength": float(os.getenv("HIGGSFIELD_MOTION_STRENGTH", "0.6")),
        "enhance_prompt": True,
        "check_nsfw": True,
    }
    image_url = os.getenv("HIGGSFIELD_IMAGE_URL")
    if image_url:
        payload["image_urls"] = [image_url]
    log.info("Segmind higgsfield-image2video …")
    return _save_media_response(_seg_post("higgsfield-image2video", payload), dest)


def _segmind_thumbnail(thumb_prompt: str, dest: Path) -> Path:
    payload = {
        "prompt": thumb_prompt,
        "width_and_height": os.getenv("HIGGSFIELD_THUMB_SIZE", "2048x1152"),  # 16:9
        "style_id": require("HIGGSFIELD_STYLE_ID"),
        "enhance_prompt": True,
        "quality": "1080p",
    }
    log.info("Segmind higgsfield-text2image-soul …")
    return _save_media_response(_seg_post("higgsfield-text2image-soul", payload), dest)


# --- Higgsfield official backend (CLI/MCP) --------------------------------

def _higgsfield_via_cli(kind: str, prompt: str, dest: Path) -> Path:
    """Best-effort bridge to the official Higgsfield CLI, if installed.

    The official Higgsfield integration is OAuth + credit based and is normally
    driven through its skill/MCP (`npx skills add higgsfield-ai/skills`), not a
    plain REST endpoint. If a `higgsfield` binary is on PATH we try it; otherwise
    we raise with guidance (use VISUALS_BACKEND=segmind for fully headless runs).
    """
    binary = shutil.which("higgsfield")
    if not binary:
        raise RuntimeError(
            "VISUALS_BACKEND=higgsfield selected but no `higgsfield` CLI was found. "
            "Install/authenticate the official Higgsfield skill "
            "(`npx skills add higgsfield-ai/skills`) and drive it via its MCP, or set "
            "VISUALS_BACKEND=segmind for a fully headless REST pipeline."
        )
    cmd = [binary, kind, "--prompt", prompt, "--out", str(dest)]
    log.info("higgsfield %s …", kind)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not Path(dest).exists():
        raise RuntimeError(f"higgsfield CLI failed: {proc.stderr.strip()[:400]}")
    return dest


# --- thumbnail normalisation ---------------------------------------------

def make_thumbnail_1280x720(src: Path, dest: Path) -> Path:
    """Scale + center-crop any still to a 1280x720 JPG."""
    run_ffmpeg(
        ["-i", str(src), "-vf",
         "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
         "-frames:v", "1", str(dest)],
        desc="thumbnail -> 1280x720",
    )
    return dest


def loop_video_to_duration(src: Path, dest: Path, seconds: int, seamless: bool = True) -> Path:
    """Loop a short clip to ``seconds``. When ``seamless`` is set, build a
    forward+reverse "boomerang" first so the loop point has no hard cut."""
    src = Path(src)
    if seamless:
        boom = src.with_suffix(".boom.mp4")
        run_ffmpeg(
            ["-i", str(src), "-filter_complex",
             "[0:v]reverse[r];[0:v][r]concat=n=2:v=1:a=0[v]",
             "-map", "[v]", "-an", str(boom)],
            desc="boomerang base",
        )
        base = boom
    else:
        base = src
    run_ffmpeg(
        ["-stream_loop", "-1", "-i", str(base), "-t", str(int(seconds)),
         "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(dest)],
        desc=f"loop video to {int(seconds)}s",
    )
    return dest


def generate_visuals(pkg: dict, audio_duration: float) -> tuple[Path, Path]:
    """Generate the short clip and the thumbnail. Returns (clip_path, thumb_path)."""
    out_dir = OUTPUT_DIR / pkg["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    clip_raw = out_dir / "clip_raw.mp4"
    thumb_raw = out_dir / "thumb_raw.png"
    thumb = out_dir / "thumbnail.jpg"

    backend = (settings.visuals_backend or "segmind").lower()
    if backend == "segmind":
        _segmind_clip(pkg["visual_prompt"], clip_raw)
        _segmind_thumbnail(pkg["thumbnail_prompt"], thumb_raw)
    elif backend == "higgsfield":
        _higgsfield_via_cli("video", pkg["visual_prompt"], clip_raw)
        _higgsfield_via_cli("image", pkg["thumbnail_prompt"], thumb_raw)
    else:
        raise ValueError(f"Unknown VISUALS_BACKEND: {backend!r} (use 'segmind' or 'higgsfield')")

    make_thumbnail_1280x720(thumb_raw, thumb)
    log.info("Clip %.1fs, thumbnail %s (target audio %.0fs)",
             ffprobe_duration(clip_raw), thumb.name, audio_duration)
    return clip_raw, thumb
