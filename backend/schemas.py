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


class ShelfLocation(BaseModel):
    shelf_id: int
    shelf_label: str
    shelf_row: int = 1
    position_in_row: int = 0


class SearchResult(BaseModel):
    book: BookOut
    shelf_labels: list[str]
    locations: list[ShelfLocation] = []
