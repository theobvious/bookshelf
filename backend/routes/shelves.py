import asyncio
import json
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Book, Shelf, ShelfBook
from routes.books import _book_to_out
from schemas import BookOut, ExtractionResult, ShelfDetailOut, ShelfOut
from services import enrichment, vision

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
ENRICH_CONCURRENCY = 12  # max simultaneous Open Library / Google Books calls

router = APIRouter(prefix="/api/shelves", tags=["shelves"])


def _load_shelf(db: Session, shelf_id: int) -> Shelf | None:
    """Load a shelf with books eagerly to avoid N+1 queries."""
    return (
        db.query(Shelf)
        .options(selectinload(Shelf.shelf_books).selectinload(ShelfBook.book))
        .filter(Shelf.id == shelf_id)
        .first()
    )


def _shelf_to_out(shelf: Shelf, db: Session) -> ShelfOut:
    book_count = len(shelf.shelf_books)
    needs_review_count = sum(1 for sb in shelf.shelf_books if sb.book and sb.book.needs_review)
    return ShelfOut(
        id=shelf.id,
        label=shelf.label,
        photo_path=shelf.photo_path,
        created_at=shelf.created_at,
        book_count=book_count,
        needs_review_count=needs_review_count,
    )


def _shelf_to_detail(shelf: Shelf, db: Session) -> ShelfDetailOut:
    base = _shelf_to_out(shelf, db)
    books = [_book_to_out(sb.book, db) for sb in shelf.shelf_books if sb.book]
    return ShelfDetailOut(**base.model_dump(), books=books)


@router.get("/", response_model=list[ShelfOut])
def list_shelves(db: Session = Depends(get_db)):
    shelves = (
        db.query(Shelf)
        .options(selectinload(Shelf.shelf_books).selectinload(ShelfBook.book))
        .order_by(Shelf.created_at)
        .all()
    )
    return [_shelf_to_out(s, db) for s in shelves]


@router.get("/{shelf_id}", response_model=ShelfDetailOut)
def get_shelf(shelf_id: int, db: Session = Depends(get_db)):
    shelf = _load_shelf(db, shelf_id)
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    return _shelf_to_detail(shelf, db)


@router.post("/", response_model=ExtractionResult, status_code=201)
async def create_shelf(
    label: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    shelf = Shelf(label=label)
    db.add(shelf)
    db.flush()

    extracted_books: list[BookOut] = []

    if photo and photo.filename:
        ext = os.path.splitext(photo.filename)[1].lower() or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        os.makedirs(UPLOAD_DIR, exist_ok=True)

        content = await photo.read()
        with open(filepath, "wb") as f:
            f.write(content)

        shelf.photo_path = f"/uploads/{filename}"
        db.flush()

        # Extract books via Claude vision (single API call regardless of shelf size)
        raw_books = vision.extract_books_from_image(filepath)

        # Enrich all books concurrently — dramatically faster for large shelves
        sem = asyncio.Semaphore(ENRICH_CONCURRENCY)

        async def enrich(raw: dict) -> dict:
            async with sem:
                return await enrichment.enrich_book(
                    raw.get("title"), raw.get("author"), raw.get("language")
                )

        metas = await asyncio.gather(*[enrich(r) for r in raw_books])

        for raw, meta in zip(raw_books, metas):
            book = Book(
                title=raw.get("title"),
                original_title=raw.get("original_title") or raw.get("title"),
                author=raw.get("author"),
                language=raw.get("language"),
                isbn=meta.get("isbn"),
                cover_url=meta.get("cover_url"),
                description=meta.get("description"),
                genres=json.dumps(meta.get("genres") or []),
                needs_review=raw.get("needs_review", False),
                confidence=raw.get("confidence"),
                review_notes=raw.get("notes"),
                source="extracted",
            )
            db.add(book)
            db.flush()
            db.add(ShelfBook(shelf_id=shelf.id, book_id=book.id))
            db.flush()
            extracted_books.append(_book_to_out(book, db))

    db.commit()

    needs_review_count = sum(1 for b in extracted_books if b.needs_review)
    shelf = _load_shelf(db, shelf.id)
    shelf_out = _shelf_to_out(shelf, db)

    return ExtractionResult(
        shelf=shelf_out,
        extracted=extracted_books,
        needs_review_count=needs_review_count,
    )


@router.patch("/{shelf_id}", response_model=ShelfOut)
def update_shelf_label(shelf_id: int, label: str = Form(...), db: Session = Depends(get_db)):
    shelf = _load_shelf(db, shelf_id)
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    shelf.label = label
    db.commit()
    return _shelf_to_out(shelf, db)


@router.delete("/{shelf_id}", status_code=204)
def delete_shelf(shelf_id: int, db: Session = Depends(get_db)):
    shelf = db.get(Shelf, shelf_id)
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    db.delete(shelf)
    db.commit()
