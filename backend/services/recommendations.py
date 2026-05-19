import json
import os
from typing import Optional

import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
async_client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

RECOMMEND_PROMPT = """I have a bookshelf labeled "{label}" containing these books:

{book_list}

Please:
1. Identify the theme or themes of this shelf in 1–2 sentences.
2. Recommend 8 books that would fit well on this shelf that are NOT in the list above.

For each recommendation provide the title, author, and one sentence explaining why it fits.
Be specific: reference the actual books on the shelf in your reasons where relevant.

Return ONLY this JSON (no prose, no markdown fences):
{{
  "theme": "...",
  "recommendations": [
    {{"title": "...", "author": "...", "reason": "..."}}
  ]
}}"""


def get_recommendations(shelf_label: str, books: list[dict]) -> dict:
    if not books:
        return {"theme": "Empty shelf", "recommendations": []}

    book_list = "\n".join(
        f"- {b['title'] or 'Unknown'} by {b.get('author') or 'Unknown author'}"
        + (f"  [genres: {', '.join(b['genres'][:3])}]" if b.get("genres") else "")
        for b in books
    )

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{"role": "user", "content": RECOMMEND_PROMPT.format(label=shelf_label, book_list=book_list)}],
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        lines = response_text.splitlines()
        response_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    return json.loads(response_text)


BOOK_RECOMMEND_PROMPT = """I am looking for book recommendations similar to:

Title: {title}
Author: {author}
Description: {description}
Genres: {genres}
Language: {language}

Please recommend exactly 6 books that are similar to this one but NOT by the same author ({author}).
Focus on thematic similarity, style, or subject matter.

Return ONLY a JSON array with no prose or markdown fences:
[{{"title":"...","author":"...","reason":"..."}}]"""


async def get_book_recommendations(book: dict) -> list:
    title = book.get("title") or "Unknown"
    author = book.get("author") or "Unknown"
    description = book.get("description") or "Not available"
    genres = ", ".join(book.get("genres") or []) or "Not specified"
    language = book.get("language") or "en"

    message = await async_client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": BOOK_RECOMMEND_PROMPT.format(
                title=title,
                author=author,
                description=description,
                genres=genres,
                language=language,
            )
        }],
    )

    response_text = message.content[0].text.strip()
    if response_text.startswith("```"):
        lines = response_text.splitlines()
        response_text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    return json.loads(response_text)
