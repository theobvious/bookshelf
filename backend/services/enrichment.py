import httpx

OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json"
OPEN_LIBRARY_COVER = "https://covers.openlibrary.org/b/id/{}-M.jpg"
GOOGLE_BOOKS_SEARCH = "https://www.googleapis.com/books/v1/volumes"


async def enrich_book(title: str | None, author: str | None, language: str | None) -> dict:
    """Fetch additional metadata from Open Library, falling back to Google Books."""
    if not title:
        return {}

    result = await _try_open_library(title, author, language)
    if not result.get("cover_url") and not result.get("isbn"):
        # Try Google Books as fallback for better coverage
        google = await _try_google_books(title, author)
        # Merge: prefer Open Library data, fill gaps with Google Books
        for key, val in google.items():
            if not result.get(key):
                result[key] = val

    return result


async def _try_open_library(title: str, author: str | None, language: str | None) -> dict:
    query = title
    if author:
        query += f" {author}"

    params: dict = {"q": query, "limit": 3, "fields": "title,author_name,isbn,cover_i,subject,first_sentence,language"}
    if language and language != "en":
        params["lang"] = language

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(OPEN_LIBRARY_SEARCH, params=params)
        if resp.status_code != 200 or not resp.json().get("docs"):
            return {}

        docs = resp.json()["docs"]
        doc = _best_match(docs, title, author)
        if not doc:
            return {}

        result: dict = {}
        if doc.get("isbn"):
            result["isbn"] = doc["isbn"][0]
        if doc.get("cover_i"):
            result["cover_url"] = OPEN_LIBRARY_COVER.format(doc["cover_i"])
        if doc.get("subject"):
            result["genres"] = doc["subject"][:8]
        if doc.get("first_sentence"):
            fs = doc["first_sentence"]
            if isinstance(fs, dict):
                result["description"] = fs.get("value", "")
            elif isinstance(fs, str):
                result["description"] = fs
        return result
    except Exception:
        return {}


async def _try_google_books(title: str, author: str | None) -> dict:
    query = f'intitle:"{title}"'
    if author:
        query += f' inauthor:"{author}"'

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(GOOGLE_BOOKS_SEARCH, params={"q": query, "maxResults": 1})
        if resp.status_code != 200:
            return {}

        items = resp.json().get("items", [])
        if not items:
            return {}

        info = items[0].get("volumeInfo", {})
        result: dict = {}

        if info.get("industryIdentifiers"):
            for ident in info["industryIdentifiers"]:
                if ident.get("type") in ("ISBN_13", "ISBN_10"):
                    result["isbn"] = ident["identifier"]
                    break

        if info.get("imageLinks", {}).get("thumbnail"):
            result["cover_url"] = info["imageLinks"]["thumbnail"].replace("http://", "https://")

        if info.get("categories"):
            result["genres"] = info["categories"]

        if info.get("description"):
            result["description"] = info["description"][:500]

        return result
    except Exception:
        return {}


def _best_match(docs: list[dict], title: str, author: str | None) -> dict | None:
    """Pick the doc whose title most closely matches."""
    title_lower = title.lower()
    for doc in docs:
        doc_title = (doc.get("title") or "").lower()
        if title_lower in doc_title or doc_title in title_lower:
            return doc
    return docs[0] if docs else None
