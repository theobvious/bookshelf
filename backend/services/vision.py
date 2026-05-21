import base64
import io
import json
import os

import anthropic
from PIL import Image, ImageOps

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
- Some spines may be printed upside-down or rotated — mentally rotate them and read the text anyway
- Do NOT invent or guess titles — if truly unreadable set title to null and needs_review to true
- For worn, sideways, or obscured spines: extract what you can, set needs_review true, explain in notes
- Preserve non-Latin scripts (Arabic, Hebrew, Japanese, Chinese, Korean, Cyrillic, etc.) exactly
- The bbox should tightly wrap the spine including the title text area

Return ONLY the JSON array. No prose, no markdown fences."""

RETRY_PROMPT = """This image is a bookshelf photo rotated 180°. Some spines that were unreadable in the original orientation may now be readable.

For each spine in this rotated image, return a JSON array with the same fields as before:
- "title", "original_title", "author", "language", "row", "position", "bbox", "confidence", "needs_review", "notes"

The bbox coordinates should be for THIS rotated image (I will convert them back).
Only include books you can actually read — do not include books with null titles unless you have a bbox for them.

Return ONLY the JSON array. No prose, no markdown fences."""


def _resize_for_upload(img: Image.Image) -> tuple:
    max_dim = 4000
    if max(img.width, img.height) > max_dim:
        ratio = max_dim / max(img.width, img.height)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue(), "image/jpeg"


def _encode(img: Image.Image) -> tuple[str, str]:
    data, media_type = _resize_for_upload(img)
    return base64.standard_b64encode(data).decode("utf-8"), media_type


def _parse_json_array(text: str) -> list:
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


def _normalise(books: list) -> list:
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

        bbox = book.get("bbox")
        if not (isinstance(bbox, list) and len(bbox) == 4
                and all(isinstance(v, (int, float)) for v in bbox)):
            book["bbox"] = None

        if book.get("confidence", 0) < CONFIDENCE_THRESHOLD or not book.get("title"):
            book["needs_review"] = True
        else:
            book.setdefault("needs_review", False)
    return books


def _flip_bbox(bbox: list) -> list:
    """Convert a bbox from a 180°-rotated image back to original coordinates."""
    x, y, w, h = bbox
    return [1 - x - w, 1 - y - h, w, h]


def _call_claude(image_data: str, media_type: str, prompt: str) -> list:
    message = _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=8096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_data}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
    return _parse_json_array(text)


def sample_spine_color(image_path: str, bbox: list) -> str | None:
    """Crop a spine bbox and return its dominant hex color, darkened for readability."""
    try:
        if not (isinstance(bbox, (list, tuple)) and len(bbox) == 4):
            return None
        img = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
        iw, ih = img.size
        x, y, bw, bh = bbox

        left   = max(0,  int(x * iw) + 1)
        top    = max(0,  int(y * ih) + 1)
        right  = min(iw, int((x + bw) * iw) - 1)
        bottom = min(ih, int((y + bh) * ih) - 1)

        if right <= left or bottom <= top:
            return None

        spine = img.crop((left, top, right, bottom)).resize((15, 40), Image.LANCZOS)
        pixels = list(spine.getdata())

        filtered = [
            p for p in pixels
            if not (p[0] > 215 and p[1] > 215 and p[2] > 215)
            and not (p[0] < 35  and p[1] < 35  and p[2] < 35)
        ]
        if len(filtered) < 5:
            filtered = pixels

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
    # Respect EXIF orientation so phones photos arrive right-side-up
    img = ImageOps.exif_transpose(Image.open(image_path))

    image_data, media_type = _encode(img)
    books = _normalise(_call_claude(image_data, media_type, EXTRACTION_PROMPT))

    # Second pass: rotate 180° and retry only if some books are still unreadable
    unreadable = [b for b in books if not b.get("title")]
    if unreadable:
        rotated = img.rotate(180)
        rot_data, rot_media = _encode(rotated)
        retried = _normalise(_call_claude(rot_data, rot_media, RETRY_PROMPT))

        # Build a map of existing bboxes to avoid duplicating already-read books
        existing_bboxes = {
            tuple(round(v, 2) for v in b["bbox"])
            for b in books if b.get("bbox") and b.get("title")
        }

        for book in retried:
            if not book.get("title"):
                continue
            # Flip bbox back to original image coordinates
            if book.get("bbox"):
                book["bbox"] = _flip_bbox(book["bbox"])
                flipped_key = tuple(round(v, 2) for v in book["bbox"])
                if flipped_key in existing_bboxes:
                    continue  # already captured in first pass
            books.append(book)

    return books
