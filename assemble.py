"""Step 5 — assemble final.mp4.

Loops the short background clip across the full audio length and muxes the
looped video + final audio into a single H.264 / AAC mp4 at /output/<slug>/final.mp4.

A single ffmpeg pass does both: ``-stream_loop -1`` repeats the short clip and
``-shortest`` stops the output at the end of the audio track.
"""
from __future__ import annotations

from pathlib import Path

from config.settings import OUTPUT_DIR
from util import ffprobe_duration, get_logger, run_ffmpeg

log = get_logger("assemble")


def assemble(pkg: dict, video_path: Path, audio_path: Path) -> Path:
    out_dir = OUTPUT_DIR / pkg["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    final = out_dir / "final.mp4"

    duration = ffprobe_duration(audio_path)
    run_ffmpeg(
        ["-stream_loop", "-1", "-i", str(video_path), "-i", str(audio_path),
         "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30",
         "-c:a", "aac", "-b:a", "192k",
         "-shortest", "-movflags", "+faststart", str(final)],
        desc=f"assemble final.mp4 ({duration:.0f}s)",
    )
    log.info("Wrote %s (%.0fs)", final, ffprobe_duration(final))
    return final
