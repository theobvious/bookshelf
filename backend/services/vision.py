import base64
import io
import json
import os

import anthropic
from PIL import Image

CONFIDENCE_THRESHOLD = 0.75

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client

EXTRACTION_PROMPT = """Analyze this photo of a bookshelf.

First, count how many distinct horizontal rows of books are visible (a single shelf board = one row).

Then, for every visible book spine, return a JSON array. Each element must have:
- "title": the title exactly as written on the spine (preserve original language and script, do NOT translate)
- "original_title": same as title unless you know a more canonical form
- "author": author name as written on the spine, or null if not visible
- "language": ISO 639-1 code (e.g. "en", "fr", "de", "es", "it", "ja", "zh", "ar", "ru", etc.)
- "row": integer — which horizontal shelf row this book is on (1 = topmost row visible, 2 = second, etc.)
- "position": integer — left-to-right index within that row (0 = leftmost)
- "bbox": [x, y, w, h] — bounding box of this spine as fractions of image width/height (all values 0.0–1.0)
- "confidence": float 0.0–1.0 for how clearly you can read this spine
- "needs_review": true if confidence < 0.75 OR if any field is uncertain
- "notes": short explanation of any uncertainty, or null

Rules:
- Include ALL books, even partially visible ones
- Do NOT invent or guess titles — if unreadable set title to null and needs_review to true
- For worn, sideways, or obscured spines: extract what you can, set needs_review true, explain in notes
- Preserve non-Latin scripts (Arabic, Hebrew, Japanese, Chinese, Korean, Cyrillic, etc.) exactly
- The bbox should tightly wrap the spine including the title text area

Return ONLY the JSON array. No prose, no markdown fences."""


def _resize_for_upload(image_path: str) -> tuple:
    img = Image.open(image_path)
    max_dim = 4000
    if max(img.width, img.height) > max_dim:
        ratio = max_dim / max(img.width, img.height)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue(), "image/jpeg"


def _parse_json_array(text: str) -> list:
    """Parse JSON array, recovering partial results if the response was truncated."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        last_brace = text.rfind("}")
        if last_brace == -1:
            return []
        try:
            return json.loads(text[: last_brace + 1] + "]")
        except json.JSONDecodeError:
            return []


def sample_spine_color(image_path: str, bbox: list) -> str | None:
    """Crop a spine bbox and return its dominant hex color, darkened for readability."""
    try:
        if not (isinstance(bbox, (list, tuple)) and len(bbox) == 4):
            return None
        img = Image.open(image_path).convert("RGB")
        iw, ih = img.size
        x, y, bw, bh = bbox

        left  = max(0,  int(x * iw) + 1)
        top   = max(0,  int(y * ih) + 1)
        right = min(iw, int((x + bw) * iw) - 1)
        bottom= min(ih, int((y + bh) * ih) - 1)

        if right <= left or bottom <= top:
            return None

        spine = img.crop((left, top, right, bottom)).resize((15, 40), Image.LANCZOS)
        pixels = list(spine.getdata())

        # Exclude near-white (text) and near-black (shadow/edge)
        filtered = [
            p for p in pixels
            if not (p[0] > 215 and p[1] > 215 and p[2] > 215)
            and not (p[0] < 35  and p[1] < 35  and p[2] < 35)
        ]
        if len(filtered) < 5:
            filtered = pixels

        # Weight each pixel by its saturation so vivid hues dominate over neutral grays
        r_sum = g_sum = b_sum = total_w = 0.0
        for r, g, b in filtered:
            hi, lo = max(r, g, b), min(r, g, b)
            sat = (hi - lo) / hi if hi > 0 else 0
            w = max(0.05, sat)
            r_sum += r * w; g_sum += g * w; b_sum += b * w; total_w += w

        r = int(r_sum / total_w * 0.78)
        g = int(g_sum / total_w * 0.78)
        b = int(b_sum / total_w * 0.78)
        return f"#{r:02x}{g:02x}{b:02x}"
    except Exception:
        return None


def extract_books_from_image(image_path: str) -> list:
    image_bytes, media_type = _resize_for_upload(image_path)
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=8096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_data},
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ],
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        lines = response_text.splitlines()
        response_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    books = _parse_json_array(response_text)

    for book in books:
        book.setdefault("title", None)
        book.setdefault("original_title", book.get("title"))
        book.setdefault("author", None)
        book.setdefault("language", None)
        book.setdefault("confidence", 0.5)
        book.setdefault("notes", None)
        book.setdefault("row", 1)
        book.setdefault("position", 0)
        book.setdefault("bbox", None)

        # Validate bbox: must be a 4-element list of floats in [0, 1]
        bbox = book.get("bbox")
        if not (isinstance(bbox, list) and len(bbox) == 4 and all(isinstance(v, (int, float)) for v in bbox)):
            book["bbox"] = None

        if book.get("confidence", 0) < CONFIDENCE_THRESHOLD or not book.get("title"):
            book["needs_review"] = True
        else:
            book.setdefault("needs_review", False)

    return books
