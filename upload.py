"""Step 7 — upload to YouTube as PRIVATE (never public).

Uses the YouTube Data API v3 (google-api-python-client + google-auth-oauthlib)
with a local OAuth2 token cache. videos.insert sets status.privacyStatus to
"private" by default; "public" is refused outright. thumbnails.set attaches the
generated 1280x720 thumbnail.
"""
from __future__ import annotations

from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from config.settings import BASE_DIR, require, settings
from util import get_logger

log = get_logger("upload")

# youtube.upload covers both videos.insert and thumbnails.set.
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TOKEN_PATH = BASE_DIR / "token.json"

# This tool intentionally never publishes publicly.
ALLOWED_PRIVACY = {"private", "unlisted"}


def _service():
    """Return an authenticated YouTube service, caching the OAuth token locally."""
    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            secret = require("YOUTUBE_CLIENT_SECRET")
            flow = InstalledAppFlow.from_client_secrets_file(secret, SCOPES)
            log.info("Opening browser for YouTube OAuth consent…")
            creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json())
        log.info("Saved OAuth token to %s", TOKEN_PATH)
    return build("youtube", "v3", credentials=creds)


def upload(pkg: dict, video_path: Path, thumbnail_path: Path | None, privacy: str = "private") -> str:
    """Upload the video as private/unlisted and set its thumbnail. Returns the URL."""
    if privacy not in ALLOWED_PRIVACY:
        raise ValueError(
            f"Refusing privacyStatus={privacy!r}. This pipeline only uploads "
            f"{sorted(ALLOWED_PRIVACY)} — it never publishes publicly."
        )

    service = _service()
    body = {
        "snippet": {
            "title": pkg["youtube_title"][:100],
            "description": pkg.get("youtube_description", ""),
            "tags": pkg.get("youtube_tags", [])[:15],
            "categoryId": settings.youtube_category_id,
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(str(video_path), mimetype="video/mp4", resumable=True,
                            chunksize=8 * 1024 * 1024)
    request = service.videos().insert(part="snippet,status", body=body, media_body=media)

    log.info("Uploading %s as %s…", Path(video_path).name, privacy)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            log.info("…upload %d%%", int(status.progress() * 100))
    video_id = response["id"]
    log.info("Uploaded video id=%s", video_id)

    if thumbnail_path and Path(thumbnail_path).exists():
        service.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(str(thumbnail_path), mimetype="image/jpeg"),
        ).execute()
        log.info("Thumbnail set")

    url = f"https://youtu.be/{video_id}"
    print(f"\n▶ Uploaded ({privacy}): {url}"
          f"\n  Studio: https://studio.youtube.com/video/{video_id}/edit\n")
    return url
