import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from models import Book, Shelf, ShelfBook
from schemas import BookCreate, BookOut, BookUpdate, SearchResult, ShelfLocation, ShelfOut
from services import enrichment

router = APIRouter(prefix="/api/books", tags=["books"])


def _book_to_out(book: Book, db: Session, context_shelf_id: Optional[int] = None) -> BookOut:
    shelf_row = 1
    position_in_row = 0
    shelf_photo_url = None

    for sb in book.shelf_books:
        if context_shelf_id and sb.shelf_id == context_shelf_id:
            shelf_row = sb.shelf_row or 1
            position_in_row = sb.position_in_row or 0
            shelf = db.get(Shelf, sb.shelf_id)
            if shelf:
                shelf_photo_url = shelf.photo_path
            break
        if not context_shelf_id and shelf_photo_url is None:
            shelf = db.get(Shelf, sb.shelf_id)
            if shelf and shelf.photo_path:
                shelf_photo_url = shelf.photo_path

    genres = []
    if book.genres:
        try:
            genres = json.loads(book.genres)
        except Exception:
            genres = []

    bbox = None
    if book.bbox:
        try:
            bbox = json.loads(book.bbox)
        except Exception:
            bbox = None

    return BookOut(
        id=book.id,
        title=book.title,
        original_title=book.original_title,
        author=book.author,
        isbn=book.isbn,
        language=book.language,
        description=book.description,
        cover_url=book.cover_url,
        genres=genres,
        needs_review=book.needs_review,
        confidence=book.confidence,
        review_notes=book.review_notes,
        lent_to=book.lent_to,
        source=book.source,
        created_at=book.created_at,
        shelf_row=shelf_row,
        position_in_row=position_in_row,
        bbox=bbox,
        shelf_photo_url=shelf_photo_url,
    )


def _assert_book_owner(book_id: int, user_sub: str, db: Session) -> Book:
    """Return the book if it belongs to one of the user's shelves, else raise 404."""
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


@router.get("/", response_model=list[BookOut])
def list_books(
    needs_review: Optional[bool] = None,
    shelf_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    query = (
        db.query(Book)
        .join(ShelfBook, ShelfBook.book_id == Book.id)
        .join(Shelf, Shelf.id == ShelfBook.shelf_id)
        .filter(Shelf.owner_sub == user["sub"])
    )
    if needs_review is not None:
        query = query.filter(Book.needs_review == needs_review)
    if shelf_id is not None:
        query = query.filter(ShelfBook.shelf_id == shelf_id)
    books = query.order_by(Book.created_at.desc()).all()
    return [_book_to_out(b, db) for b in books]


@router.get("/search", response_model=list[SearchResult])
def search_books(q: str, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    if not q.strip():
        return []

    rows = db.execute(
        text("SELECT rowid FROM books_fts WHERE books_fts MATCH :q ORDER BY rank LIMIT 50"),
        {"q": q.strip() + "*"},
    ).fetchall()

    # Get the set of shelf IDs owned by this user for filtering
    owned_shelf_ids = {
        row[0] for row in db.execute(
            text("SELECT id FROM shelves WHERE owner_sub = :sub"),
            {"sub": user["sub"]},
        ).fetchall()
    }

    results = []
    for (book_id,) in rows:
        book = db.get(Book, book_id)
        if not book:
            continue

        locations = []
        shelf_labels = []
        for sb in book.shelf_books:
            if sb.shelf_id not in owned_shelf_ids:
                continue
            shelf = db.get(Shelf, sb.shelf_id)
            if shelf:
                shelf_labels.append(shelf.label)
                locations.append(ShelfLocation(
                    shelf_id=sb.shelf_id,
                    shelf_label=shelf.label,
                    shelf_row=sb.shelf_row or 1,
                    position_in_row=sb.position_in_row or 0,
                ))

        if not locations:
            continue  # book not on any of the user's shelves

        results.append(SearchResult(
            book=_book_to_out(book, db),
            shelf_labels=shelf_labels,
            locations=locations,
        ))

    return results


@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: int, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    book = _assert_book_owner(book_id, user["sub"], db)
    return _book_to_out(book, db)


@router.post("/", response_model=BookOut, status_code=201)
def create_book(payload: BookCreate, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    if payload.shelf_id:
        shelf = db.query(Shelf).filter(
            Shelf.id == payload.shelf_id, Shelf.owner_sub == user["sub"]
        ).first()
        if not shelf:
            raise HTTPException(status_code=404, detail="Shelf not found")

    book = Book(
        title=payload.title,
        original_title=payload.original_title or payload.title,
        author=payload.author,
        isbn=payload.isbn,
        language=payload.language or "en",
        description=payload.description,
        cover_url=payload.cover_url,
        genres=json.dumps(payload.genres or []),
        needs_review=payload.needs_review,
        confidence=payload.confidence,
        review_notes=payload.review_notes,
        source="manual",
    )
    db.add(book)
    db.flush()

    if payload.shelf_id:
        db.add(ShelfBook(shelf_id=payload.shelf_id, book_id=book.id))

    db.commit()
    db.refresh(book)
    return _book_to_out(book, db)


@router.put("/{book_id}", response_model=BookOut)
def update_book(book_id: int, payload: BookUpdate, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    book = _assert_book_owner(book_id, user["sub"], db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "genres":
            setattr(book, field, json.dumps(value or []))
        else:
            setattr(book, field, value)

    db.commit()
    db.refresh(book)
    return _book_to_out(book, db)


@router.post("/{book_id}/confirm", response_model=BookOut)
def confirm_book(book_id: int, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    book = _assert_book_owner(book_id, user["sub"], db)
    book.needs_review = False
    db.commit()
    db.refresh(book)
    return _book_to_out(book, db)


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: int, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    book = _assert_book_owner(book_id, user["sub"], db)
    db.delete(book)
    db.commit()


@router.post("/{book_id}/enrich", response_model=BookOut)
async def enrich_book(book_id: int, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    book = _assert_book_owner(book_id, user["sub"], db)
    if not book.title:
        return _book_to_out(book, db)

    meta = await enrichment.enrich_book(book.title, book.author, book.language)

    if not book.author and meta.get("author"):
        book.author = meta["author"]
    if not book.isbn and meta.get("isbn"):
        book.isbn = meta["isbn"]
    if not book.cover_url and meta.get("cover_url"):
        book.cover_url = meta["cover_url"]
    if not book.description and meta.get("description"):
        book.description = meta["description"]
    if not book.genres and meta.get("genres"):
        book.genres = json.dumps(meta["genres"])

    db.commit()
    db.refresh(book)
    return _book_to_out(book, db)
