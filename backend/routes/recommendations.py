import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Shelf
from schemas import RecommendationsOut
from services.recommendations import get_recommendations

router = APIRouter(prefix="/api/shelves", tags=["recommendations"])


@router.get("/{shelf_id}/recommendations", response_model=RecommendationsOut)
def shelf_recommendations(shelf_id: int, db: Session = Depends(get_db)):
    shelf = db.get(Shelf, shelf_id)
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")

    books = []
    for sb in shelf.shelf_books:
        if sb.book and not sb.book.needs_review:
            genres = []
            if sb.book.genres:
                try:
                    genres = json.loads(sb.book.genres)
                except Exception:
                    pass
            books.append({
                "title": sb.book.title,
                "author": sb.book.author,
                "genres": genres,
            })

    result = get_recommendations(shelf.label, books)
    return RecommendationsOut(
        shelf_id=shelf_id,
        theme=result.get("theme", ""),
        recommendations=result.get("recommendations", []),
    )
