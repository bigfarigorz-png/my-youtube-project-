"""Telegram notifications + remote approval.

All sends are best-effort: if Telegram is unconfigured or unreachable, helpers
log a warning and return ``None`` so the pipeline can fall back to the CLI.
The one thing they must never do is silently approve a gate — that decision is
made in ``main.py`` (Telegram tap OR explicit CLI confirmation, never auto).

Verified against the Telegram Bot API (core.telegram.org/bots/api):
  sendMessage / sendDocument / sendVideo / getUpdates / answerCallbackQuery.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Iterable

import requests

from config.settings import settings
from util import get_logger

log = get_logger("notify")

_TIMEOUT = 20
# Last processed update_id + 1. Tracked so an old button tap is never re-read
# as the answer to a new question.
_offset: int | None = None


def enabled() -> bool:
    return settings.telegram_enabled()


def _base() -> str:
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}"


def _post(method: str, **kwargs):
    if not enabled():
        return None
    try:
        resp = requests.post(f"{_base()}/{method}", timeout=_TIMEOUT, **kwargs)
        if resp.status_code >= 400:
            log.warning("Telegram %s -> %s: %s", method, resp.status_code, resp.text[:200])
            return None
        return resp.json()
    except requests.RequestException as exc:
        log.warning("Telegram %s failed: %s", method, exc)
        return None


def send_message(text: str):
    """POST sendMessage with HTML formatting."""
    return _post("sendMessage", json={
        "chat_id": settings.telegram_chat_id,
        "text": text,
        "parse_mode": "HTML",
    })


def _keyboard(options: Iterable) -> dict:
    """Build an inline_keyboard. Each option is a label string or a
    (label, callback_data) pair. Up to 4 buttons per row."""
    buttons = []
    for opt in options:
        if isinstance(opt, (tuple, list)):
            label, data = str(opt[0]), str(opt[1])
        else:
            label = data = str(opt)
        buttons.append({"text": label, "callback_data": data})
    rows = [buttons[i:i + 4] for i in range(0, len(buttons), 4)]
    return {"inline_keyboard": rows}


def send_with_buttons(text: str, options: Iterable):
    """POST sendMessage with an inline keyboard of one button per option."""
    return _post("sendMessage", json={
        "chat_id": settings.telegram_chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": _keyboard(options),
    })


def send_file(path: str | Path, caption: str = ""):
    """Deliver a file: sendVideo for video, sendDocument otherwise (multipart)."""
    if not enabled():
        return None
    path = Path(path)
    if not path.exists():
        log.warning("send_file: %s does not exist", path)
        return None
    is_video = path.suffix.lower() in {".mp4", ".mov", ".mkv", ".webm"}
    method = "sendVideo" if is_video else "sendDocument"
    field = "video" if is_video else "document"
    try:
        with open(path, "rb") as fh:
            data = {
                "chat_id": settings.telegram_chat_id,
                "caption": caption[:1000],
                "parse_mode": "HTML",
            }
            resp = requests.post(f"{_base()}/{method}", data=data, files={field: fh}, timeout=600)
        if resp.status_code >= 400:
            log.warning("Telegram %s -> %s: %s", method, resp.status_code, resp.text[:200])
            return None
        return resp.json()
    except requests.RequestException as exc:
        log.warning("send_file failed: %s", exc)
        return None


def _get_updates(long_poll: int = 15) -> list[dict]:
    params: dict = {"timeout": long_poll}
    if _offset is not None:
        params["offset"] = _offset
    try:
        resp = requests.get(f"{_base()}/getUpdates", params=params, timeout=long_poll + 10)
        if resp.status_code >= 400:
            log.warning("getUpdates -> %s", resp.status_code)
            return []
        return resp.json().get("result", [])
    except requests.RequestException as exc:
        log.warning("getUpdates failed: %s", exc)
        return []


def _advance(update: dict) -> None:
    global _offset
    _offset = update["update_id"] + 1


def _answer(callback_id: str | None, text: str = "Got it ✓") -> None:
    if callback_id:
        _post("answerCallbackQuery", json={"callback_query_id": callback_id, "text": text})


def prime() -> None:
    """Fast-forward past any taps queued before the pipeline started so that
    stale presses are not read as answers to this run's questions."""
    if not enabled():
        return
    for update in _get_updates(long_poll=0):
        _advance(update)


def wait_for_button(timeout: int = 300, expected: set[str] | None = None) -> str | None:
    """Poll getUpdates until a callback_query with matching callback_data arrives.

    Answers the callback (stops the button spinner) and returns its data, or
    ``None`` on timeout / when Telegram is disabled or unreachable.
    """
    if not enabled():
        return None
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        remaining = int(deadline - time.monotonic())
        for update in _get_updates(long_poll=min(20, max(0, remaining))):
            _advance(update)
            cq = update.get("callback_query")
            if not cq:
                continue
            data = cq.get("data")
            _answer(cq.get("id"))
            if expected is None or data in expected:
                return data
            # Foreign/stale tap — ignore and keep waiting.
    return None
