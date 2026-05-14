import base64
import json
import os
from pathlib import Path

import anthropic
from PIL import Image

CONFIDENCE_THRESHOLD = 0.75

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

EXTRACTION_PROMPT = """Analyze this photo of a bookshelf. For each visible book spine, extract information and return a JSON array.

Each element must have:
- "title": the title exactly as written on the spine (preserve original language and script — do NOT translate)
- "original_title": same as title unless you know a more canonical form, e.g. if the spine shows a translated title
- "author": author name as written on the spine, or null if not visible
- "language": ISO 639-1 code for the language of the title (e.g. "en", "fr", "de", "es", "it", "ja", "zh", "ar", "ru", "pt", "nl", "ko", "he", "pl", etc.)
- "confidence": float 0.0–1.0 for how clearly you can read this spine
- "needs_review": true if confidence < 0.75 OR if any field is uncertain
- "notes": short explanation of any uncertainty, or null

Rules:
- Include ALL books, even partially visible ones
- Do NOT invent or guess titles — if unreadable, set title to null and needs_review to true
- For books where text is sideways, worn, or partially obscured: extract what you can, set needs_review true, explain in notes
- Preserve non-Latin scripts (Arabic, Hebrew, Japanese, Chinese, Korean, Cyrillic, Greek, etc.) exactly

Return ONLY the JSON array. No prose, no markdown fences."""


def _resize_for_upload(image_path: str) -> tuple[bytes, str]:
    """Resize image if too large, return bytes and media type."""
    img = Image.open(image_path)

    max_dim = 4000
    if max(img.width, img.height) > max_dim:
        ratio = max_dim / max(img.width, img.height)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # Convert to RGB if needed (handles RGBA PNG etc.)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    import io
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue(), "image/jpeg"


def extract_books_from_image(image_path: str) -> list[dict]:
    """Send shelf photo to Claude and return extracted book data."""
    image_bytes, media_type = _resize_for_upload(image_path)
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ],
    )

    response_text = message.content[0].text.strip()

    # Strip accidental markdown code fences
    if response_text.startswith("```"):
        lines = response_text.splitlines()
        response_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    books = json.loads(response_text)

    # Normalise fields
    for book in books:
        book.setdefault("title", None)
        book.setdefault("original_title", book.get("title"))
        book.setdefault("author", None)
        book.setdefault("language", None)
        book.setdefault("confidence", 0.5)
        book.setdefault("notes", None)

        # Enforce needs_review based on confidence even if Claude forgot to set it
        if book.get("confidence", 0) < CONFIDENCE_THRESHOLD or not book.get("title"):
            book["needs_review"] = True
        else:
            book.setdefault("needs_review", False)

    return books
