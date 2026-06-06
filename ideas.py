"""Step 1 & 2 — idea generation and the full content package, via the Anthropic
Messages API.

Model: ``claude-opus-4-8`` (the latest / most capable Claude model — see
docs.claude.com). We use adaptive thinking so reasoning lands in a separate
thinking block and the visible text block stays clean JSON.
"""
from __future__ import annotations

import json
import re

import anthropic

from config.settings import OUTPUT_DIR, require
from util import get_logger

log = get_logger("ideas")

# Current Claude model. Adaptive thinking is the recommended mode on Opus 4.8.
MODEL = "claude-opus-4-8"

CHANNEL_BRIEF = (
    "a faceless YouTube channel in the sleep / calm / positive-affirmations niche. "
    "The content helps viewers relax, drift off to sleep, or build a calmer, more "
    "positive mindset. Videos are long, slow-paced, soothing, and original."
)


def _client() -> anthropic.Anthropic:
    # The SDK retries 429/5xx automatically; max_retries widens that.
    return anthropic.Anthropic(api_key=require("ANTHROPIC_API_KEY"), max_retries=4)


def _extract_json(text: str) -> dict:
    """Parse a JSON object out of a model response, tolerating code fences."""
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z0-9]*\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end > start:
        raw = raw[start:end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Model did not return valid JSON ({exc}). First 300 chars:\n{text[:300]}"
        ) from exc


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return (slug or "video")[:60]


def generate_ideas(n: int = 8) -> list[dict]:
    """Brainstorm ``n`` video ideas. Returns a list of {title, concept} dicts."""
    client = _client()
    prompt = (
        f"Brainstorm {n} distinct, original video ideas for {CHANNEL_BRIEF}\n\n"
        f'Return ONLY a JSON object of the form {{"ideas":[{{"title":"...",'
        f'"concept":"one-sentence description"}}]}} with exactly {n} items. '
        "No prose, no markdown."
    )
    msg = client.messages.create(
        model=MODEL,
        max_tokens=5000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    text = next(b.text for b in msg.content if b.type == "text")
    ideas = _extract_json(text)["ideas"][:n]
    log.info("Generated %d ideas", len(ideas))
    return ideas


def generate_package(idea: dict) -> dict:
    """Generate the full production package for the chosen idea.

    Returns a dict with: narration_script (~1500 words), music_style,
    visual_prompt, thumbnail_prompt, youtube_title, youtube_description,
    youtube_tags (15), plus the originating idea and a slug.
    """
    client = _client()
    title = idea["title"]
    concept = idea.get("concept", "")

    system = (
        "You are an expert scriptwriter and producer for " + CHANNEL_BRIEF +
        " You write calming, original, copyright-safe content. Never reference real "
        "songs, brands, or copyrighted works."
    )
    user = (
        f"Selected video idea:\nTitle: {title}\nConcept: {concept}\n\n"
        "Produce a COMPLETE production package. Return ONLY a JSON object with exactly "
        "these keys (no markdown, no commentary):\n"
        "{\n"
        '  "narration_script": "Approximately 1500 words. Either a calming sleep story OR '
        'a set of affirmations, whichever fits the idea. Gentle, slow, soothing; '
        'second person where natural. Plain prose only.",\n'
        '  "music_style": "A short prompt describing the ideal ambient/instrumental backing '
        'track: genre, mood, instruments, tempo.",\n'
        '  "visual_prompt": "A vivid, cinematic prompt for a short looping background video '
        '(calming, slow camera motion, no text, no people\'s faces).",\n'
        '  "thumbnail_prompt": "A prompt for a single still 1280x720 thumbnail image.",\n'
        '  "youtube_title": "<= 100 characters, calming and inviting (not clickbait).",\n'
        '  "youtube_description": "2-4 short paragraphs ending with a soft invitation to '
        'subscribe; make clear it is for relaxation / sleep.",\n'
        '  "youtube_tags": ["exactly", "15", "short", "relevant", "tags"]\n'
        "}\n"
    )

    log.info("Generating script + prompts for: %s", title)
    # Stream to avoid HTTP timeouts on the long (~1500 word) generation.
    with client.messages.stream(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=system,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        final = stream.get_final_message()

    text = next(b.text for b in final.content if b.type == "text")
    pkg = _extract_json(text)

    # Fail clearly here (step 2) if the model dropped a field, rather than as a
    # KeyError deep inside audio/visuals.
    required = ["narration_script", "music_style", "visual_prompt",
                "thumbnail_prompt", "youtube_description"]
    missing = [k for k in required if not pkg.get(k)]
    if missing:
        raise RuntimeError(f"Model response is missing required fields: {missing}")

    # Normalise / guard the fields we depend on downstream.
    pkg.setdefault("youtube_tags", [])
    pkg["youtube_tags"] = [str(t) for t in pkg["youtube_tags"]][:15]
    pkg["youtube_title"] = str(pkg.get("youtube_title", title))[:100]
    pkg["idea"] = idea
    pkg["slug"] = slugify(title)
    return pkg


def save_package(pkg: dict):
    """Write the package to /output/<slug>/script.json and return the path."""
    out_dir = OUTPUT_DIR / pkg["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "script.json"
    path.write_text(json.dumps(pkg, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("Saved package to %s", path)
    return path
