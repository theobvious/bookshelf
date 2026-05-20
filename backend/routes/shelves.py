import asyncio
import json
import os
import uuid
from typing import Optional

import imagehash
from PIL import Image
from rapidfuzz import fuzz
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from auth import require_auth
from database import get_db
from models import Book, Shelf, ShelfBook
from routes.books import _book_to_out
from schemas import (
    AnalyzeResult, ApplyDiffBody, BookOut, CreateFromAnalysisBody,
    DiffBody, DiffResult, ExtractionResult, MergeRowBody,
    ShelfDetailOut, ShelfOut, SimilarShelf,
)
from services import enrichment, vision

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))
ENRICH_CONCURRENCY = 12

router = APIRouter(prefix="/api/shelves", tags=["shelves"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_shelf(db: Session, shelf_id: int, owner_sub: str) -> Optional[Shelf]:
    return (
        db.query(Shelf)
        .options(selectinload(Shelf.shelf_books).selectinload(ShelfBook.book))
        .filter(Shelf.id == shelf_id, Shelf.owner_sub == owner_sub)
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
    books = [_book_to_out(sb.book, db, context_shelf_id=shelf.id) for sb in shelf.shelf_books if sb.book]
    return ShelfDetailOut(**base.model_dump(), books=books)


def _compute_photo_hash(filepath: str) -> Optional[str]:
    try:
        img = Image.open(filepath)
        return str(imagehash.phash(img))
    except Exception:
        return None


def _compute_title_overlap(titles1: list[str], titles2: list[str]) -> float:
    if not titles1 or not titles2:
        return 0.0
    matched = 0
    used: set[int] = set()
    for t1 in titles1:
        best_ratio = 0
        best_j = -1
        for j, t2 in enumerate(titles2):
            if j in used:
                continue
            ratio = fuzz.token_sort_ratio(t1.lower(), t2.lower())
            if ratio > best_ratio:
                best_ratio = ratio
                best_j = j
        if best_ratio >= 80:
            matched += 1
            if best_j >= 0:
                used.add(best_j)
    return matched / max(len(titles1), len(titles2))


def _temp_path_to_filepath(temp_photo_path: str) -> str:
    filename = temp_photo_path.split("/")[-1]
    return os.path.join(UPLOAD_DIR, filename)


async def _enrich_books(raw_books: list[dict]) -> list[dict]:
    if not raw_books:
        return []
    sem = asyncio.Semaphore(ENRICH_CONCURRENCY)

    async def enrich(raw: dict) -> dict:
        async with sem:
            return await enrichment.enrich_book(
                raw.get("title"), raw.get("author"), raw.get("language")
            )

    return list(await asyncio.gather(*[enrich(r) for r in raw_books]))


def _create_book_from_raw(db: Session, raw: dict, meta: dict, filepath: Optional[str]) -> Book:
    bbox = raw.get("bbox")
    spine_color = raw.get("spine_color")
    if not spine_color and filepath and bbox:
        spine_color = vision.sample_spine_color(filepath, bbox)
    book = Book(
        title=raw.get("title"),
        original_title=raw.get("original_title") or raw.get("title"),
        author=raw.get("author") or meta.get("author"),
        language=raw.get("language", "en"),
        isbn=meta.get("isbn"),
        cover_url=meta.get("cover_url"),
        description=meta.get("description"),
        genres=json.dumps(meta.get("genres") or []),
        needs_review=raw.get("needs_review", False),
        confidence=raw.get("confidence"),
        review_notes=raw.get("notes"),
        bbox=json.dumps(bbox) if bbox else None,
        spine_color=spine_color,
        is_behind=raw.get("is_behind", False),
        source="extracted",
    )
    db.add(book)
    db.flush()
    return book


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ShelfOut])
def list_shelves(db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    shelves = (
        db.query(Shelf)
        .options(selectinload(Shelf.shelf_books).selectinload(ShelfBook.book))
        .filter(Shelf.owner_sub == user["sub"])
        .order_by(Shelf.created_at)
        .all()
    )
    return [_shelf_to_out(s, db) for s in shelves]


@router.post("/analyze", response_model=AnalyzeResult)
async def analyze_shelf(
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Save photo, extract books via vision, and find visually/textually similar shelves."""
    ext = os.path.splitext(photo.filename or "")[1].lower() or ".jpg"
    filename = f"temp_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    content = await photo.read()
    with open(filepath, "wb") as f:
        f.write(content)

    temp_photo_path = f"/uploads/{filename}"

    raw_books = vision.extract_books_from_image(filepath)

    for raw in raw_books:
        bbox = raw.get("bbox")
        if bbox and not raw.get("spine_color"):
            raw["spine_color"] = vision.sample_spine_color(filepath, bbox)

    photo_hash = _compute_photo_hash(filepath)

    user_shelves = (
        db.query(Shelf)
        .options(selectinload(Shelf.shelf_books).selectinload(ShelfBook.book))
        .filter(Shelf.owner_sub == user["sub"])
        .all()
    )

    extracted_titles = [b.get("title", "") for b in raw_books if b.get("title")]
    similar: list[SimilarShelf] = []

    for shelf in user_shelves:
        photo_sim = 0.0
        is_photo_similar = False
        if photo_hash and shelf.photo_hash:
            try:
                h1 = imagehash.hex_to_hash(photo_hash)
                h2 = imagehash.hex_to_hash(shelf.photo_hash)
                distance = h1 - h2
                photo_sim = max(0.0, 1.0 - distance / 64.0)
                is_photo_similar = distance < 12
            except Exception:
                pass

        shelf_titles = [sb.book.title for sb in shelf.shelf_books if sb.book and sb.book.title]
        overlap = _compute_title_overlap(extracted_titles, shelf_titles)
        is_book_similar = overlap > 0.6

        if not (is_photo_similar or is_book_similar):
            continue

        confidence = photo_sim * 0.4 + overlap * 0.6
        similar.append(SimilarShelf(
            shelf=_shelf_to_out(shelf, db),
            confidence=round(confidence, 3),
            photo_similarity=round(photo_sim, 3),
            book_overlap=round(overlap, 3),
        ))

    similar.sort(key=lambda x: x.confidence, reverse=True)

    return AnalyzeResult(
        extracted_books=raw_books,
        photo_hash=photo_hash,
        temp_photo_path=temp_photo_path,
        similar_shelves=similar[:3],
    )


@router.post("/from-analysis", response_model=ExtractionResult, status_code=201)
async def create_shelf_from_analysis(
    body: CreateFromAnalysisBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Create a new shelf from pre-analyzed book data (avoids re-running vision)."""
    shelf = Shelf(
        label=body.label,
        owner_sub=user["sub"],
        photo_path=body.temp_photo_path,
        photo_hash=body.photo_hash,
    )
    db.add(shelf)
    db.flush()

    filepath = _temp_path_to_filepath(body.temp_photo_path) if body.temp_photo_path else None
    raw_books = [b.model_dump() for b in body.extracted_books]
    metas = await _enrich_books(raw_books)

    extracted_books: list[BookOut] = []
    for i, (raw, meta) in enumerate(zip(raw_books, metas)):
        book = _create_book_from_raw(db, raw, meta, filepath)
        db.add(ShelfBook(
            shelf_id=shelf.id,
            book_id=book.id,
            shelf_row=raw.get("row", 1),
            position_in_row=raw.get("position", i),
        ))
        db.flush()
        extracted_books.append(_book_to_out(book, db, context_shelf_id=shelf.id))

    db.commit()
    needs_review_count = sum(1 for b in extracted_books if b.needs_review)
    shelf = _load_shelf(db, shelf.id, user["sub"])
    return ExtractionResult(
        shelf=_shelf_to_out(shelf, db),
        extracted=extracted_books,
        needs_review_count=needs_review_count,
    )


@router.post("/", response_model=ExtractionResult, status_code=201)
async def create_shelf(
    label: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    shelf = Shelf(label=label, owner_sub=user["sub"])
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
        shelf.photo_hash = _compute_photo_hash(filepath)
        db.flush()

        raw_books = vision.extract_books_from_image(filepath)
        metas = await _enrich_books(raw_books)

        for raw, meta in zip(raw_books, metas):
            book = _create_book_from_raw(db, raw, meta, filepath)
            db.add(ShelfBook(
                shelf_id=shelf.id,
                book_id=book.id,
                shelf_row=raw.get("row", 1),
                position_in_row=raw.get("position", 0),
            ))
            db.flush()
            extracted_books.append(_book_to_out(book, db, context_shelf_id=shelf.id))

    db.commit()

    needs_review_count = sum(1 for b in extracted_books if b.needs_review)
    shelf = _load_shelf(db, shelf.id, user["sub"])
    return ExtractionResult(
        shelf=_shelf_to_out(shelf, db),
        extracted=extracted_books,
        needs_review_count=needs_review_count,
    )


@router.get("/{shelf_id}", response_model=ShelfDetailOut)
def get_shelf(shelf_id: int, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    shelf = _load_shelf(db, shelf_id, user["sub"])
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    return _shelf_to_detail(shelf, db)


@router.post("/{shelf_id}/diff", response_model=DiffResult)
def diff_shelf(
    shelf_id: int,
    body: DiffBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Compare extracted books from a new photo against an existing shelf."""
    shelf = _load_shelf(db, shelf_id, user["sub"])
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")

    existing = [(sb.book, sb) for sb in shelf.shelf_books if sb.book]
    new_titles = [b.title for b in body.extracted_books if b.title]

    matched: list[BookOut] = []
    removed: list[BookOut] = []
    used_new: set[int] = set()

    for book, _sb in existing:
        is_matched = False
        if book.title:
            for j, new_title in enumerate(new_titles):
                if j in used_new:
                    continue
                if fuzz.token_sort_ratio(book.title.lower(), new_title.lower()) >= 80:
                    is_matched = True
                    used_new.add(j)
                    break
        if is_matched:
            matched.append(_book_to_out(book, db, context_shelf_id=shelf_id))
        else:
            removed.append(_book_to_out(book, db, context_shelf_id=shelf_id))

    existing_titles = [book.title for book, _ in existing if book.title]
    added = []
    for extracted in body.extracted_books:
        if not extracted.title:
            added.append(extracted)
            continue
        is_matched = any(
            fuzz.token_sort_ratio(extracted.title.lower(), t.lower()) >= 80
            for t in existing_titles
        )
        if not is_matched:
            added.append(extracted)

    return DiffResult(matched=matched, added=added, removed=removed)


@router.post("/{shelf_id}/apply-diff", response_model=ExtractionResult)
async def apply_diff(
    shelf_id: int,
    body: ApplyDiffBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Remove books and add new books to an existing shelf, optionally updating its photo."""
    shelf = _load_shelf(db, shelf_id, user["sub"])
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")

    for book_id in body.remove:
        sb = (
            db.query(ShelfBook)
            .filter(ShelfBook.shelf_id == shelf_id, ShelfBook.book_id == book_id)
            .first()
        )
        if sb:
            db.delete(sb)
            db.flush()
            remaining = db.query(ShelfBook).filter(ShelfBook.book_id == book_id).count()
            if remaining == 0:
                book = db.query(Book).filter(Book.id == book_id).first()
                if book:
                    db.delete(book)
            db.flush()

    filepath = None
    if body.temp_photo_path:
        shelf.photo_path = body.temp_photo_path
        if body.photo_hash:
            shelf.photo_hash = body.photo_hash
        filepath = _temp_path_to_filepath(body.temp_photo_path)
    db.flush()

    max_position = (
        db.query(func.max(ShelfBook.position_in_row))
        .filter(ShelfBook.shelf_id == shelf_id)
        .scalar()
    ) or 0

    raw_books = [b.model_dump() for b in body.add]
    metas = await _enrich_books(raw_books)

    added_books: list[BookOut] = []
    for i, (raw, meta) in enumerate(zip(raw_books, metas)):
        book = _create_book_from_raw(db, raw, meta, filepath)
        db.add(ShelfBook(
            shelf_id=shelf_id,
            book_id=book.id,
            shelf_row=raw.get("row", 1),
            position_in_row=raw.get("position", max_position + i + 1),
        ))
        db.flush()
        added_books.append(_book_to_out(book, db, context_shelf_id=shelf_id))

    db.commit()
    shelf = _load_shelf(db, shelf_id, user["sub"])
    return ExtractionResult(
        shelf=_shelf_to_out(shelf, db),
        extracted=added_books,
        needs_review_count=sum(1 for b in added_books if b.needs_review),
    )


@router.post("/{shelf_id}/merge-row", response_model=ExtractionResult)
async def merge_row(
    shelf_id: int,
    body: MergeRowBody,
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    """Add extracted books as a new shelf_row (for multi-row physical shelves)."""
    shelf = _load_shelf(db, shelf_id, user["sub"])
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")

    max_row = (
        db.query(func.max(ShelfBook.shelf_row))
        .filter(ShelfBook.shelf_id == shelf_id)
        .scalar()
    ) or 0
    next_row = max_row + 1

    filepath = _temp_path_to_filepath(body.temp_photo_path) if body.temp_photo_path else None

    raw_books = [b.model_dump() for b in body.extracted_books]
    metas = await _enrich_books(raw_books)

    added_books: list[BookOut] = []
    for i, (raw, meta) in enumerate(zip(raw_books, metas)):
        book = _create_book_from_raw(db, raw, meta, filepath)
        db.add(ShelfBook(
            shelf_id=shelf_id,
            book_id=book.id,
            shelf_row=next_row,
            position_in_row=raw.get("position", i),
        ))
        db.flush()
        added_books.append(_book_to_out(book, db, context_shelf_id=shelf_id))

    db.commit()
    shelf = _load_shelf(db, shelf_id, user["sub"])
    return ExtractionResult(
        shelf=_shelf_to_out(shelf, db),
        extracted=added_books,
        needs_review_count=sum(1 for b in added_books if b.needs_review),
    )


@router.patch("/{shelf_id}", response_model=ShelfOut)
def update_shelf_label(
    shelf_id: int,
    label: str = Form(...),
    db: Session = Depends(get_db),
    user: dict = Depends(require_auth),
):
    shelf = _load_shelf(db, shelf_id, user["sub"])
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    shelf.label = label
    db.commit()
    return _shelf_to_out(shelf, db)


@router.delete("/{shelf_id}", status_code=204)
def delete_shelf(shelf_id: int, db: Session = Depends(get_db), user: dict = Depends(require_auth)):
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id, Shelf.owner_sub == user["sub"]).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    db.delete(shelf)
    db.commit()
