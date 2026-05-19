import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Book, Recommendation, Shelf
from schemas import RecommendationOut, RecommendationUpdate, RecommendationsOut
from services.enrichment import enrich_book
from services.recommendations import get_book_recommendations, get_recommendations as get_shelf_recommendations

router = APIRouter(tags=["recommendations"])


# ── Shelf-level endpoint ─────────────────────────────────────────────────────

@router.post("/api/shelves/{shelf_id}/recommendations", response_model=list[RecommendationOut])
async def shelf_recommendations(
    shelf_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    shelf = db.get(Shelf, shelf_id)
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")

    if regenerate:
        db.query(Recommendation).filter(
            Recommendation.source_shelf_id == shelf_id,
            Recommendation.dismissed == False,
        ).update({"dismissed": True})
        db.commit()

    existing = db.query(Recommendation).filter(
        Recommendation.source_shelf_id == shelf_id,
        Recommendation.dismissed == False,
    ).all()
    if existing and not regenerate:
        return [_rec_to_out(r) for r in existing]

    books = []
    for sb in shelf.shelf_books:
        if sb.book and not sb.book.needs_review:
            genres = []
            if sb.book.genres:
                try:
                    genres = json.loads(sb.book.genres)
                except Exception:
                    pass
            books.append({"title": sb.book.title, "author": sb.book.author, "genres": genres})

    result = get_shelf_recommendations(shelf.label, books)
    raw_recs = result.get("recommendations", [])

    enrichment_tasks = [enrich_book(r.get("title"), r.get("author"), None) for r in raw_recs]
    enriched_list = await asyncio.gather(*enrichment_tasks)

    saved = []
    for raw, enriched in zip(raw_recs, enriched_list):
        rec = Recommendation(
            source_shelf_id=shelf_id,
            title=raw.get("title", ""),
            author=raw.get("author"),
            reason=raw.get("reason"),
            cover_url=enriched.get("cover_url"),
            isbn=enriched.get("isbn"),
        )
        db.add(rec)
        db.flush()
        saved.append(rec)

    db.commit()
    for rec in saved:
        db.refresh(rec)

    return [_rec_to_out(r) for r in saved]


# ── New per-book recommendation endpoints ────────────────────────────────────

def _rec_to_out(rec: Recommendation) -> RecommendationOut:
    return RecommendationOut(
        id=rec.id,
        source_book_id=rec.source_book_id,
        source_book_title=rec.source_book.title if rec.source_book else None,
        source_book_author=rec.source_book.author if rec.source_book else None,
        source_shelf_id=rec.source_shelf_id,
        source_shelf_label=rec.source_shelf.label if rec.source_shelf else None,
        title=rec.title,
        author=rec.author,
        reason=rec.reason,
        cover_url=rec.cover_url,
        isbn=rec.isbn,
        acquired=rec.acquired,
        dismissed=rec.dismissed,
        created_at=rec.created_at,
    )


@router.post("/api/books/{book_id}/recommend", response_model=list[RecommendationOut])
async def recommend_for_book(
    book_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    book = db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # If regenerating, dismiss existing recommendations
    if regenerate:
        existing = db.query(Recommendation).filter(
            Recommendation.source_book_id == book_id,
            Recommendation.dismissed == False,
        ).all()
        for rec in existing:
            rec.dismissed = True
        db.commit()

    # Return cached recommendations if they exist and not regenerating
    if not regenerate:
        existing = db.query(Recommendation).filter(
            Recommendation.source_book_id == book_id,
            Recommendation.dismissed == False,
        ).all()
        if existing:
            return [_rec_to_out(r) for r in existing]

    # Build book dict for the service
    genres = []
    if book.genres:
        try:
            genres = json.loads(book.genres)
        except Exception:
            pass

    book_dict = {
        "title": book.title,
        "author": book.author,
        "description": book.description,
        "genres": genres,
        "language": book.language,
    }

    # Get Claude recommendations
    raw_recs = await get_book_recommendations(book_dict)

    # Enrich concurrently
    enrichment_tasks = [enrich_book(r.get("title"), r.get("author"), None) for r in raw_recs]
    enriched_list = await asyncio.gather(*enrichment_tasks)

    # Persist
    saved = []
    for raw, enriched in zip(raw_recs, enriched_list):
        rec = Recommendation(
            source_book_id=book_id,
            title=raw.get("title", ""),
            author=raw.get("author"),
            reason=raw.get("reason"),
            cover_url=enriched.get("cover_url"),
            isbn=enriched.get("isbn"),
            acquired=False,
            dismissed=False,
        )
        db.add(rec)
        db.flush()
        rec.source_book  # load relationship
        saved.append(rec)

    db.commit()
    for rec in saved:
        db.refresh(rec)

    return [_rec_to_out(r) for r in saved]


@router.get("/api/recommendations/", response_model=list[RecommendationOut])
def list_recommendations(
    acquired: Optional[bool] = Query(default=None),
    dismissed: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Recommendation)
    if acquired is not None:
        q = q.filter(Recommendation.acquired == acquired)
    if dismissed is not None:
        q = q.filter(Recommendation.dismissed == dismissed)
    recs = q.order_by(Recommendation.source_book_id, Recommendation.created_at).all()
    return [_rec_to_out(r) for r in recs]


@router.patch("/api/recommendations/{rec_id}", response_model=RecommendationOut)
def update_recommendation(
    rec_id: int,
    data: RecommendationUpdate,
    db: Session = Depends(get_db),
):
    rec = db.get(Recommendation, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if data.acquired is not None:
        rec.acquired = data.acquired
    if data.dismissed is not None:
        rec.dismissed = data.dismissed
    db.commit()
    db.refresh(rec)
    return _rec_to_out(rec)


@router.delete("/api/recommendations/", status_code=204)
def clear_recommendations(
    acquired: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Recommendation)
    if acquired is not None:
        q = q.filter(Recommendation.acquired == acquired)
    q.delete(synchronize_session=False)
    db.commit()


@router.delete("/api/recommendations/{rec_id}", status_code=204)
def delete_recommendation(rec_id: int, db: Session = Depends(get_db)):
    rec = db.get(Recommendation, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    db.delete(rec)
    db.commit()
