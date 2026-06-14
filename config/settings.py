"""Central configuration.

Secrets and tunables are loaded from a local ``.env`` file (see ``.env.example``).
Nothing is ever hardcoded here — every key is read from the environment, and the
required ones are fetched lazily via :func:`require` so a run only fails on a key
it actually needs (e.g. MODE_OWN_VOICE never touches the text-to-speech key).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# --- Project layout -------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
INPUT_DIR = BASE_DIR / "input"
OUTPUT_DIR = BASE_DIR / "output"

# Load .env from the project root once at import (no-op if the file is absent).
load_dotenv(BASE_DIR / ".env")

INPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class ConfigError(RuntimeError):
    """Raised when a required configuration value is missing."""


def _get(name: str, default: str | None = None) -> str | None:
    """Return a stripped env var, or ``default`` when unset/blank."""
    val = os.getenv(name)
    if val is None or val.strip() == "":
        return default
    return val.strip()


def require(name: str) -> str:
    """Return an env var or raise a clear error naming the missing key."""
    val = _get(name)
    if not val:
        raise ConfigError(
            f"Missing required configuration: {name}. "
            f"Add it to your .env file (see .env.example)."
        )
    return val


@dataclass(frozen=True)
class Settings:
    """Non-secret tunables with sensible defaults."""

    # Behaviour
    audio_mode: str = _get("AUDIO_MODE", "MODE_OWN_VOICE")
    visuals_backend: str = _get("VISUALS_BACKEND", "segmind")
    target_length_seconds: int = int(_get("TARGET_LENGTH_SECONDS", "1800"))

    # YouTube
    youtube_category_id: str = _get("YOUTUBE_CATEGORY_ID", "22")  # People & Blogs

    # MusicGPT
    musicgpt_webhook_url: str | None = _get("MUSICGPT_WEBHOOK_URL")

    # Telegram
    telegram_bot_token: str | None = _get("TELEGRAM_BOT_TOKEN")
    telegram_chat_id: str | None = _get("TELEGRAM_CHAT_ID")

    # How long to wait for a Telegram tap before falling back to the CLI gate.
    approval_timeout_seconds: int = int(_get("APPROVAL_TIMEOUT_SECONDS", "900"))

    def telegram_enabled(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id)


settings = Settings()
