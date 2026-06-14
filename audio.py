"""Step 3 — audio generation & mixing (MusicGPT + ffmpeg).

Two modes:
  MODE_OWN_VOICE  — generate an instrumental ambient bed, mix it UNDER the user's
                    own narration dropped at input/voiceover.mp3.
  MODE_FULL_AUTO  — generate narration via MusicGPT Text-to-Speech AND a separate
                    instrumental bed, then mix.
The mixed track is then looped/extended with ffmpeg to the target length (default 1800s).

Endpoints verified against docs.musicgpt.com:
  POST https://api.musicgpt.com/api/public/v1/MusicAI        (header: Authorization: <key>)
  POST https://api.musicgpt.com/api/public/v1/TextToSpeech
  GET  https://api.musicgpt.com/api/public/v1/byId?conversionType=...&task_id=...
       -> { "conversion": { "status": "COMPLETED", "audio_url": "..." } }
Results arrive by webhook or polling; we poll the byId status endpoint.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import requests

from config.settings import INPUT_DIR, OUTPUT_DIR, require, settings
from util import download, ffprobe_duration, get_logger, retry, run_ffmpeg

log = get_logger("audio")

BASE = "https://api.musicgpt.com/api/public/v1"
MODE_OWN_VOICE = "MODE_OWN_VOICE"
MODE_FULL_AUTO = "MODE_FULL_AUTO"


def _headers() -> dict:
    # MusicGPT expects the raw key in the Authorization header (no "Bearer ").
    return {"Authorization": require("MUSICGPT_API_KEY"), "Content-Type": "application/json"}


@retry(times=4, exceptions=(requests.RequestException,))
def _post(path: str, payload: dict) -> dict:
    resp = requests.post(f"{BASE}/{path}", json=payload, headers=_headers(), timeout=60)
    if resp.status_code >= 400:
        raise requests.RequestException(f"{path} -> {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def request_instrumental(music_style: str, prompt: str | None = None,
                         output_length: float | None = None) -> dict:
    """Kick off an instrumental-only MusicAI conversion."""
    payload: dict = {
        "music_style": music_style,
        "make_instrumental": True,
        "vocal_only": False,
        "prompt": prompt or f"calming ambient instrumental backing track, {music_style}",
    }
    if output_length:
        payload["output_length"] = float(output_length)
    if settings.musicgpt_webhook_url:
        payload["webhook_url"] = settings.musicgpt_webhook_url
    data = _post("MusicAI", payload)
    log.info("MusicAI task=%s eta=%ss", data.get("task_id"), data.get("eta"))
    return data


def request_tts(text: str, gender: str = "female", voice_id: str | None = None) -> dict:
    """Kick off a Text-to-Speech narration conversion."""
    payload: dict = {"text": text, "gender": gender}
    if voice_id:
        payload["voice_id"] = voice_id
    if settings.musicgpt_webhook_url:
        payload["webhook_url"] = settings.musicgpt_webhook_url
    data = _post("TextToSpeech", payload)
    log.info("TextToSpeech task=%s eta=%ss", data.get("task_id"), data.get("eta"))
    return data


@retry(times=4, exceptions=(requests.RequestException,))
def _get_by_id(conversion_type: str, task_id: str | None, conversion_id: str | None) -> dict:
    # The byId endpoint wants task_id OR conversion_id, not both. Prefer task_id.
    params: dict = {"conversionType": conversion_type}
    if task_id:
        params["task_id"] = task_id
    elif conversion_id:
        params["conversion_id"] = conversion_id
    resp = requests.get(f"{BASE}/byId", params=params, headers=_headers(), timeout=60)
    if resp.status_code >= 400:
        raise requests.RequestException(f"byId -> {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def poll(conversion_type: str, task_id: str | None = None, conversion_id: str | None = None,
         timeout: int = 1200, interval: int = 12) -> str:
    """Poll the byId status endpoint until COMPLETED; return the audio URL."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        data = _get_by_id(conversion_type, task_id, conversion_id)
        conv = data.get("conversion") or data
        status = str(conv.get("status", "")).upper()
        url = conv.get("audio_url") or conv.get("conversion_path")
        if "FAIL" in status or "ERROR" in status:
            raise RuntimeError(f"MusicGPT conversion failed: {conv.get('status_msg') or status}")
        if url and ("COMPLET" in status or "SUCC" in status or "DONE" in status or status == ""):
            log.info("Conversion ready (%s)", status or "done")
            return url
        log.info("…waiting on MusicGPT (status=%s)", status or "pending")
        time.sleep(interval)
    raise TimeoutError("Timed out waiting for the MusicGPT conversion to complete")


# --- ffmpeg mixing / looping ---------------------------------------------

def mix_voice_and_bed(voice: Path, bed: Path, out: Path, music_volume: float = 0.22) -> Path:
    """Mix narration over a (looped) instrumental bed; output matches voice length."""
    run_ffmpeg(
        ["-i", str(voice), "-stream_loop", "-1", "-i", str(bed),
         "-filter_complex",
         f"[1:a]volume={music_volume}[bed];"
         "[0:a][bed]amix=inputs=2:duration=first:dropout_transition=3[a]",
         "-map", "[a]", "-c:a", "libmp3lame", "-q:a", "2", str(out)],
        desc="mix narration + ambient bed",
    )
    return out


def loop_to_length(src: Path, out: Path, seconds: int) -> Path:
    """Loop/extend an audio file to exactly ``seconds`` seconds."""
    run_ffmpeg(
        ["-stream_loop", "-1", "-i", str(src), "-t", str(int(seconds)),
         "-c:a", "libmp3lame", "-q:a", "2", str(out)],
        desc=f"loop audio to {int(seconds)}s",
    )
    return out


def generate_audio(pkg: dict, mode: str | None = None, target_length: int | None = None) -> Path:
    """Produce the final mixed + length-matched audio track. Returns its path."""
    mode = mode or settings.audio_mode
    target = int(target_length or settings.target_length_seconds)
    out_dir = OUTPUT_DIR / pkg["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1) Instrumental ambient bed (needed in both modes).
    bed_path = out_dir / "bed.mp3"
    inst = request_instrumental(pkg["music_style"])
    bed_url = poll("MUSIC_AI", task_id=inst.get("task_id"), conversion_id=inst.get("conversion_id_1"))
    download(bed_url, bed_path)

    # 2) Narration source.
    if mode == MODE_OWN_VOICE:
        voice_path = INPUT_DIR / "voiceover.mp3"
        if not voice_path.exists():
            raise FileNotFoundError(
                f"{voice_path} not found. For MODE_OWN_VOICE, record your narration and "
                "drop it there as voiceover.mp3."
            )
    elif mode == MODE_FULL_AUTO:
        voice_path = out_dir / "narration.mp3"
        tts = request_tts(pkg["narration_script"])
        # docs.musicgpt.com documents MUSIC_AI explicitly; the TTS conversionType
        # is overridable via env in case the value differs for your account.
        tts_type = os.getenv("MUSICGPT_TTS_CONVERSION_TYPE", "TEXT_TO_SPEECH")
        voice_url = poll(tts_type, task_id=tts.get("task_id"),
                         conversion_id=tts.get("conversion_id"))
        download(voice_url, voice_path)
    else:
        raise ValueError(f"Unknown AUDIO_MODE: {mode!r} (use MODE_OWN_VOICE or MODE_FULL_AUTO)")

    # 3) Mix, then 4) loop/extend to the target length.
    mixed = out_dir / "mixed.mp3"
    mix_voice_and_bed(voice_path, bed_path, mixed)
    final = out_dir / "audio_final.mp3"
    loop_to_length(mixed, final, target)
    log.info("Audio ready: %s (%.0fs)", final, ffprobe_duration(final))
    return final
