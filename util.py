"""Small shared helpers: logging, retry-with-backoff, downloads, and ffmpeg."""
from __future__ import annotations

import functools
import logging
import random
import shutil
import subprocess
import time
from pathlib import Path
from typing import Callable

import requests


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s", "%H:%M:%S")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


log = get_logger("quiet-hours")


def retry(times: int = 4, base_delay: float = 2.0, max_delay: float = 30.0,
          exceptions: tuple[type[BaseException], ...] = (Exception,)) -> Callable:
    """Retry a function with exponential backoff (2s, 4s, 8s, 16s … + jitter)."""

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc: BaseException | None = None
            for attempt in range(1, times + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as exc:  # noqa: PERF203
                    last_exc = exc
                    if attempt == times:
                        break
                    delay = min(max_delay, base_delay * (2 ** (attempt - 1))) + random.uniform(0, 1)
                    log.warning("%s failed (attempt %d/%d): %s — retrying in %.1fs",
                                fn.__name__, attempt, times, exc, delay)
                    time.sleep(delay)
            assert last_exc is not None
            raise last_exc

        return wrapper

    return decorator


@retry(times=4, exceptions=(requests.RequestException,))
def download(url: str, dest: str | Path, timeout: int = 180) -> Path:
    """Stream a remote file to disk."""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=timeout) as resp:
        if resp.status_code >= 400:
            raise requests.RequestException(f"download {url} -> {resp.status_code}")
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                if chunk:
                    fh.write(chunk)
    return dest


def ensure_ffmpeg() -> None:
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise RuntimeError(
                f"`{tool}` was not found on your PATH. Install ffmpeg (see README.md → Prerequisites)."
            )


def run_ffmpeg(args: list[str], desc: str = "") -> None:
    """Run ffmpeg with sane defaults; raise with stderr on failure."""
    ensure_ffmpeg()
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args]
    log.info("ffmpeg: %s", desc or " ".join(str(a) for a in args[:6]))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({desc}): {proc.stderr.strip()[:800]}")


def ffprobe_duration(path: str | Path) -> float:
    """Return media duration in seconds via ffprobe."""
    ensure_ffmpeg()
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    try:
        return float(proc.stdout.strip())
    except ValueError as exc:
        raise RuntimeError(f"Could not read duration of {path}: {proc.stderr.strip()[:300]}") from exc
