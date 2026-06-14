"""Quiet Hours Pipeline — orchestrate a faceless sleep/affirmation YouTube pipeline
with MANDATORY human approval gates. Nothing is ever auto-published.

Flow:
  1. ideas      -> PAUSE: pick one (Telegram buttons 1-8, or CLI)
  2. script     -> PRINT script + prompts, PAUSE: require "approve"
  3. audio      -> "✅ Audio done"
  4. visuals    -> "✅ Visuals done"
  5. assemble   -> show final.mp4 path, send it
  6. review     -> PAUSE: require "upload"
  7. upload     -> as PRIVATE; print the URL

The two approval pauses are impossible to skip: a Telegram tap OR an explicit
typed CLI confirmation is always required. If Telegram is unreachable the code
falls back to the CLI gate — it never auto-proceeds.
"""
from __future__ import annotations

import sys
from html import escape as esc

import assemble
import audio
import ideas
import notify
import upload
import visuals
from config.settings import settings
from util import ffprobe_duration, get_logger

log = get_logger("main")

PICK_TIMEOUT = settings.approval_timeout_seconds
GATE_TIMEOUT = settings.approval_timeout_seconds


# --- console helpers ------------------------------------------------------

def _rule(title: str) -> None:
    print(f"\n{'=' * 64}\n  {title}\n{'=' * 64}")


def print_ideas(ideas_list: list[dict]) -> None:
    _rule("STEP 1 — VIDEO IDEAS")
    for i, idea in enumerate(ideas_list, 1):
        print(f"  {i}. {idea['title']}\n     {idea.get('concept', '')}")


def present_package(pkg: dict, script_path) -> None:
    _rule("STEP 2 — SCRIPT & PROMPTS  (review carefully)")
    print(f"Title:       {pkg['youtube_title']}")
    print(f"Saved to:    {script_path}\n")
    print("Narration script:\n")
    print(pkg["narration_script"])
    print(f"\nMusic style:   {pkg['music_style']}")
    print(f"Visual prompt: {pkg['visual_prompt']}")
    print(f"Thumbnail:     {pkg['thumbnail_prompt']}")
    print(f"Tags:          {', '.join(pkg.get('youtube_tags', []))}")
    print("\nDescription:\n" + pkg.get("youtube_description", ""))


def _preview_text(pkg: dict) -> str:
    script = pkg["narration_script"]
    snippet = script[:400] + "…" if len(script) > 400 else script
    tags = ", ".join(pkg.get("youtube_tags", [])[:6])
    return (
        f"📝 <b>{esc(pkg['youtube_title'])}</b>\n\n"
        f"{esc(snippet)}\n\n"
        f"🎵 Music: {esc(pkg['music_style'][:140])}\n"
        f"🏷️ Tags: {esc(tags)}…"
    )


# --- approval gates (impossible to skip) ----------------------------------

def _cli_gate(question: str, approve: str, reject: str) -> str:
    """Block until the user types exactly the approve or reject word."""
    while True:
        try:
            ans = input(f"{question} Type '{approve}' to proceed or '{reject}' to stop: ").strip().lower()
        except EOFError:
            # No interactive stdin: refuse to proceed rather than auto-approve.
            log.error("No interactive input available — refusing to pass the approval gate.")
            return reject
        if ans == approve.lower():
            return approve
        if ans == reject.lower():
            return reject
        print(f"  Please type exactly '{approve}' or '{reject}'.")


def approval_gate(question: str, approve: str, reject: str) -> bool:
    """Return True only on an explicit human approval (Telegram tap or CLI word)."""
    choice = None
    if notify.enabled():
        notify.send_with_buttons(question, [approve, reject])
        log.info("Approval requested via Telegram (waiting up to %ss; CLI fallback otherwise).",
                 GATE_TIMEOUT)
        choice = notify.wait_for_button(GATE_TIMEOUT, expected={approve, reject})
        if choice:
            log.info("Telegram choice: %s", choice)
    if choice is None:
        if notify.enabled():
            log.warning("No Telegram reply — falling back to mandatory CLI confirmation.")
        choice = _cli_gate(question, approve, reject)
    return choice == approve


def _cli_pick(n: int) -> int:
    while True:
        try:
            ans = input(f"Pick an idea (1-{n}): ").strip()
        except EOFError as exc:
            raise SystemExit("No interactive input available to pick an idea.") from exc
        if ans.isdigit() and 1 <= int(ans) <= n:
            return int(ans) - 1
        print(f"  Enter a number 1-{n}.")


def pick_idea(ideas_list: list[dict]) -> int:
    """Pick an idea via Telegram buttons 1..N, falling back to CLI input."""
    n = len(ideas_list)
    labels = [str(i) for i in range(1, n + 1)]
    choice = None
    if notify.enabled():
        listing = "\n".join(
            f"{i}. <b>{esc(x['title'])}</b> — {esc(x.get('concept', ''))}"
            for i, x in enumerate(ideas_list, 1)
        )
        notify.send_message("💡 <b>Pick a video idea</b>\n\n" + listing)
        notify.send_with_buttons(f"Which idea? (1–{n})", labels)
        choice = notify.wait_for_button(PICK_TIMEOUT, expected=set(labels))
    if choice is None:
        return _cli_pick(n)
    return int(choice) - 1


# --- orchestration --------------------------------------------------------

def run() -> None:
    current = "startup"
    try:
        notify.prime()  # skip stale taps from a previous run
        notify.send_message("🟢 <b>Quiet Hours pipeline started</b> — generating ideas…")

        # STEP 1 — ideas + pick
        current = "ideas"
        idea_list = ideas.generate_ideas(8)
        print_ideas(idea_list)
        chosen = idea_list[pick_idea(idea_list)]
        log.info("Chosen idea: %s", chosen["title"])
        notify.send_message(f"🟢 Pipeline running for: <b>{esc(chosen['title'])}</b>")

        # STEP 2 — script + prompts, then a mandatory approval gate
        current = "script"
        pkg = ideas.generate_package(chosen)
        script_path = ideas.save_package(pkg)
        present_package(pkg, script_path)
        notify.send_message(_preview_text(pkg))
        if not approval_gate("Approve this script?", "approve", "reject"):
            notify.send_message("🛑 Script rejected — stopping the run.")
            log.info("Rejected at the script gate. Exiting.")
            return

        # STEP 3 — audio
        current = "audio"
        audio_path = audio.generate_audio(pkg)
        notify.send_message("✅ Audio done")

        # STEP 4 — visuals
        current = "visuals"
        duration = ffprobe_duration(audio_path)
        clip_path, thumb_path = visuals.generate_visuals(pkg, duration)
        notify.send_message("✅ Visuals done")

        # STEP 5 — assemble
        current = "assemble"
        final_path = assemble.assemble(pkg, clip_path, audio_path)
        notify.send_message("✅ Assembled")

        # STEP 6 — review + mandatory upload gate
        current = "review"
        _rule("STEP 6 — REVIEW")
        print(f"Final video ready: {final_path}\n")
        notify.send_file(thumb_path, caption=f"Thumbnail — {esc(pkg['youtube_title'])}")
        notify.send_file(final_path,
                         caption=f"🎬 Preview: {esc(pkg['youtube_title'])}\nWatch it, then approve the upload.")
        if not approval_gate("Upload as PRIVATE to YouTube?", "upload", "cancel"):
            notify.send_message("🛑 Upload cancelled. final.mp4 is saved locally.")
            log.info("Upload cancelled. File saved at %s", final_path)
            return

        # STEP 7 — upload (private)
        current = "upload"
        url = upload.upload(pkg, final_path, thumb_path, privacy="private")
        notify.send_message(f"📤 Uploaded (private): {url}")
        log.info("Pipeline complete.")

    except KeyboardInterrupt:
        notify.send_message(f"⏹️ Cancelled during <b>{esc(current)}</b>.")
        print("\nInterrupted.")
        sys.exit(130)
    except Exception as exc:  # noqa: BLE001 — surface any step failure to the user
        log.exception("Error in %s", current)
        notify.send_message(f"❌ Error in <b>{esc(current)}</b>: {esc(str(exc))}")
        sys.exit(1)


if __name__ == "__main__":
    run()
