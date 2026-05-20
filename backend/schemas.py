import json
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, field_validator


class BookBase(BaseModel):
    title: Optional[str] = None
    original_title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    language: Optional[str] = "en"
    description: Optional[str] = None
    cover_url: Optional[str] = None
    genres: Optional[list] = None
    needs_review: bool = False
    confidence: Optional[float] = None
    review_notes: Optional[str] = None
    lent_to: Optional[str] = None
    is_behind: bool = False
    source: str = "extracted"


class BookCreate(BookBase):
    shelf_id: Optional[int] = None


class BookUpdate(BaseModel):
    title: Optional[str] = None
    original_title: Optional[str] = None
    author: Optional[str] = None
    isbn: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    genres: Optional[list] = None
    needs_review: Optional[bool] = None
    confidence: Optional[float] = None
    lent_to: Optional[str] = None


class BookOut(BookBase):
    id: int
    created_at: datetime
    shelf_row: int = 1
    position_in_row: int = 0
    bbox: Optional[list] = None  # [x, y, w, h] fractions
    spine_color: Optional[str] = None
    shelf_photo_url: Optional[str] = None

    @field_validator("genres", mode="before")
    @classmethod
    def parse_genres(cls, v: Any) -> Optional[list]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v

    @field_validator("bbox", mode="before")
    @classmethod
    def parse_bbox(cls, v: Any) -> Optional[list]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    model_config = {"from_attributes": True}


class ShelfBase(BaseModel):
    label: str


class ShelfCreate(ShelfBase):
    pass


class ShelfOut(ShelfBase):
    id: int
    photo_path: Optional[str] = None
    created_at: datetime
    book_count: int = 0
    needs_review_count: int = 0

    model_config = {"from_attributes": True}


class ShelfDetailOut(ShelfOut):
    books: list[BookOut] = []


class ExtractionResult(BaseModel):
    shelf: ShelfOut
    extracted: list[BookOut]
    needs_review_count: int


class RecommendationItem(BaseModel):
    title: str
    author: str
    reason: str


class RecommendationsOut(BaseModel):
    shelf_id: int
    theme: str
    recommendations: list[RecommendationItem]


class RecommendationUpdate(BaseModel):
    acquired: Optional[bool] = None
    dismissed: Optional[bool] = None


class RecommendationOut(BaseModel):
    id: int
    source_book_id: Optional[int] = None
    source_book_title: Optional[str] = None
    source_book_author: Optional[str] = None
    source_shelf_id: Optional[int] = None
    source_shelf_label: Optional[str] = None
    title: str
    author: Optional[str] = None
    reason: Optional[str] = None
    cover_url: Optional[str] = None
    isbn: Optional[str] = None
    acquired: bool = False
    dismissed: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}


class ShelfLocation(BaseModel):
    shelf_id: int
    shelf_label: str
    shelf_row: int = 1
    position_in_row: int = 0


class SearchResult(BaseModel):
    book: BookOut
    shelf_labels: list[str]
    locations: list[ShelfLocation] = []


# ── Shelf identification / deduplication ──────────────────────────────────────

class ExtractedBook(BaseModel):
    title: Optional[str] = None
    original_title: Optional[str] = None
    author: Optional[str] = None
    language: Optional[str] = "en"
    row: int = 1
    position: int = 0
    bbox: Optional[list] = None
    confidence: Optional[float] = None
    needs_review: bool = False
    notes: Optional[str] = None
    spine_color: Optional[str] = None
    isbn: Optional[str] = None
    cover_url: Optional[str] = None
    description: Optional[str] = None
    genres: Optional[list] = None
    is_behind: bool = False


class SimilarShelf(BaseModel):
    shelf: ShelfOut
    confidence: float
    photo_similarity: float
    book_overlap: float


class AnalyzeResult(BaseModel):
    extracted_books: list[ExtractedBook]
    photo_hash: Optional[str] = None
    temp_photo_path: Optional[str] = None
    similar_shelves: list[SimilarShelf]


class DiffBody(BaseModel):
    extracted_books: list[ExtractedBook]


class DiffResult(BaseModel):
    matched: list[BookOut]
    added: list[ExtractedBook]
    removed: list[BookOut]


class ApplyDiffBody(BaseModel):
    add: list[ExtractedBook] = []
    remove: list[int] = []
    temp_photo_path: Optional[str] = None
    photo_hash: Optional[str] = None


class MergeRowBody(BaseModel):
    extracted_books: list[ExtractedBook]
    temp_photo_path: Optional[str] = None
    photo_hash: Optional[str] = None


class CreateFromAnalysisBody(BaseModel):
    label: str
    extracted_books: list[ExtractedBook]
    temp_photo_path: Optional[str] = None
    photo_hash: Optional[str] = None
