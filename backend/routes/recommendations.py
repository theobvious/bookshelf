import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from models import Book, Recommendation, Shelf, ShelfBook
from schemas import RecommendationOut, RecommendationUpdate, RecommendationsOut
from services.enrichment import enrich_book
from services.recommendations import get_book_recommendations, get_recommendations as get_shelf_recommendations

router = APIRouter(tags=["recommendations"])


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


def _assert_shelf_owner(shelf_id: int, user_sub: str, db: Session) -> Shelf:
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id, Shelf.owner_sub == user_sub).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    return shelf


def _assert_book_owner(book_id: int, user_sub: str, db: Session) -> Book:
    book = (
        db.query(Book)
        .join(ShelfBook, ShelfBook.book_id == Book.id)
        .join(Shelf, Shelf.id == ShelfBook.shelf_id)
        .filter(Book.id == book_id, Shelf.owner_sub == user_sub)
        .first()
    )
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.post("/api/shelves/{shelf_id}/recommendations", response_model=list[RecommendationOut])
async def shelf_recommendations(
    shelf_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    shelf = _assert_shelf_owner(shelf_id, user["sub"], db)

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


@router.post("/api/books/{book_id}/recommend", response_model=list[RecommendationOut])
async def recommend_for_book(
    book_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    book = _assert_book_owner(book_id, user["sub"], db)

    if regenerate:
        existing = db.query(Recommendation).filter(
            Recommendation.source_book_id == book_id,
            Recommendation.dismissed == False,
        ).all()
        for rec in existing:
            rec.dismissed = True
        db.commit()

    if not regenerate:
        existing = db.query(Recommendation).filter(
            Recommendation.source_book_id == book_id,
            Recommendation.dismissed == False,
        ).all()
        if existing:
            return [_rec_to_out(r) for r in existing]

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

    raw_recs = await get_book_recommendations(book_dict)

    enrichment_tasks = [enrich_book(r.get("title"), r.get("author"), None) for r in raw_recs]
    enriched_list = await asyncio.gather(*enrichment_tasks)

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
        rec.source_book
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
    user: dict = Depends(require_auth),
):
    q = (
        db.query(Recommendation)
        .outerjoin(Shelf, Shelf.id == Recommendation.source_shelf_id)
        .outerjoin(Book, Book.id == Recommendation.source_book_id)
        .outerjoin(ShelfBook, ShelfBook.book_id == Recommendation.source_book_id)
        .filter(
            (Shelf.owner_sub == user["sub"]) |
            (ShelfBook.shelf_id.in_(
                db.query(Shelf.id).filter(Shelf.owner_sub == user["sub"])
            ))
        )
    )
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
    user: dict = Depends(require_auth),
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
    user: dict = Depends(require_auth),
):
    owned_shelf_ids = db.query(Shelf.id).filter(Shelf.owner_sub == user["sub"]).subquery()
    q = db.query(Recommendation).filter(
        (Recommendation.source_shelf_id.in_(owned_shelf_ids)) |
        (Recommendation.source_book_id.in_(
            db.query(Book.id).join(ShelfBook).filter(ShelfBook.shelf_id.in_(owned_shelf_ids))
        ))
    )
    if acquired is not None:
        q = q.filter(Recommendation.acquired == acquired)
    q.delete(synchronize_session=False)
    db.commit()


@router.delete("/api/recommendations/{rec_id}", status_code=204)
def delete_recommendation(rec_id: int, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    rec = db.get(Recommendation, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    db.delete(rec)
    db.commit()
