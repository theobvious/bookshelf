import base64
import io
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

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
- "language": ISO 639-1 code (e.g. "en", "fr", "de", "es", "it", "ja", "zh", "ar", "ru", "he", etc.)
- "row": integer — which horizontal shelf row this book is on (1 = topmost row visible, 2 = second, etc.)
- "position": integer — left-to-right index within that row (0 = leftmost)
- "bbox": [x, y, w, h] — bounding box of this spine as fractions of image width/height (all values 0.0–1.0)
- "confidence": float 0.0–1.0 for how clearly you can read this spine
- "needs_review": true if confidence < 0.75 OR if any field is uncertain
- "notes": short explanation of any uncertainty, or null

Rules:
- Include ALL books, even partially visible ones
- Some spines may be printed upside-down — mentally rotate them and read the text anyway, do not mark them as unreadable solely because of orientation
- Do NOT invent or guess titles — if truly unreadable set title to null and needs_review to true
- For worn, sideways, or obscured spines: extract what you can, set needs_review true, explain in notes
- Preserve non-Latin scripts exactly:
  * Cyrillic (Russian, Ukrainian, etc.): letters like е, р, с, о, н, х resemble Latin but are different characters — output the Cyrillic, never substitute Latin lookalikes
  * Hebrew: text runs right-to-left; output words in correct RTL reading order, do not reverse or mirror them
  * Arabic: right-to-left; preserve Arabic script exactly, including diacritics if visible
  * CJK: preserve Chinese/Japanese/Korean characters exactly
- The bbox should tightly wrap the spine including the title text area

Return ONLY the JSON array. No prose, no markdown fences."""


REREAD_PROMPT = """This image shows a single book spine. Read it carefully and return a JSON object.

Script-specific guidance:
- Cyrillic (Russian, Ukrainian, etc.): letters like е, р, с, о, н, х look like Latin but are distinct Cyrillic characters — output the actual Cyrillic, never substitute Latin lookalikes
- Hebrew: text reads right-to-left; output words in correct RTL order, do not reverse or mirror characters
- Arabic: right-to-left; preserve Arabic script and any visible diacritics exactly
- Vertical spines: Western books usually read bottom-to-top; East Asian books top-to-bottom
- Upside-down spines: mentally rotate and read — do not mark unreadable solely due to orientation

Return ONLY a JSON object with:
- "title": title exactly as written (original script, do NOT translate)
- "original_title": same as title unless a more canonical form is known
- "author": author as written, or null if not visible
- "language": ISO 639-1 code
- "confidence": float 0.0–1.0
- "needs_review": true if confidence < 0.75 or any field uncertain
- "notes": brief explanation of uncertainty, or null

No prose, no markdown fences."""


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


def _crop_spine_for_reread(image_path: str, bbox: list, min_width: int = 350) -> tuple:
    """Crop a spine bbox and upscale so Claude gets a close-up view."""
    try:
        img = Image.open(image_path).convert("RGB")
        iw, ih = img.size
        x, y, bw, bh = bbox

        # Add a small margin (5% of spine width) so edges aren't clipped
        margin_x = bw * iw * 0.05
        margin_y = bh * ih * 0.05
        left   = max(0,  int(x * iw - margin_x))
        top    = max(0,  int(y * ih - margin_y))
        right  = min(iw, int((x + bw) * iw + margin_x))
        bottom = min(ih, int((y + bh) * ih + margin_y))

        if right <= left or bottom <= top:
            return None, None

        crop = img.crop((left, top, right, bottom))
        cw, ch = crop.size

        if cw < min_width:
            scale = min_width / cw
            crop = crop.resize((int(cw * scale), int(ch * scale)), Image.LANCZOS)

        buf = io.BytesIO()
        crop.save(buf, format="JPEG", quality=93)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return None, None


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


def _reread_spine(image_path: str, book: dict) -> dict:
    """Send a cropped spine image for a focused second read; merge if confidence improves."""
    bbox = book.get("bbox")
    if not (isinstance(bbox, list) and len(bbox) == 4):
        return book

    img_bytes, media_type = _crop_spine_for_reread(image_path, bbox)
    if img_bytes is None:
        return book

    image_data = base64.standard_b64encode(img_bytes).decode("utf-8")

    try:
        message = _get_client().messages.create(
            model="claude-opus-4-7",
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_data}},
                    {"type": "text", "text": REREAD_PROMPT},
                ],
            }],
        )
        text = message.content[0].text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
        result = json.loads(text)
    except Exception:
        return book

    new_conf = result.get("confidence", 0)
    old_conf = book.get("confidence", 0)

    # Accept the re-read if confidence improved or we got a title we didn't have
    if new_conf > old_conf or (result.get("title") and not book.get("title")):
        merged = {**book}
        for k, v in result.items():
            if v is not None:
                merged[k] = v
        if new_conf >= CONFIDENCE_THRESHOLD:
            merged["needs_review"] = False
        return merged

    return book


def sample_spine_color(image_path: str, bbox: list) -> str | None:
    """Crop a spine bbox and return its dominant hex color, darkened for readability."""
    try:
        if not (isinstance(bbox, (list, tuple)) and len(bbox) == 4):
            return None
        img = Image.open(image_path).convert("RGB")
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

        bbox = book.get("bbox")
        if not (isinstance(bbox, list) and len(bbox) == 4 and all(isinstance(v, (int, float)) for v in bbox)):
            book["bbox"] = None

        if book.get("confidence", 0) < CONFIDENCE_THRESHOLD or not book.get("title"):
            book["needs_review"] = True
        else:
            book.setdefault("needs_review", False)

    # Second pass: re-read low-confidence spines concurrently
    needs_reread = [i for i, b in enumerate(books) if b.get("needs_review") and b.get("bbox")]
    if needs_reread:
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(_reread_spine, image_path, books[i]): i for i in needs_reread}
            for future in as_completed(futures):
                i = futures[future]
                try:
                    books[i] = future.result()
                except Exception:
                    pass

    return books
