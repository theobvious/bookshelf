from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from database import Base


class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True)
    source_book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    isbn = Column(String, nullable=True)
    acquired = Column(Boolean, default=False)
    dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    source_book = relationship("Book", back_populates="recommendations")


class Shelf(Base):
    __tablename__ = "shelves"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False)
    photo_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    shelf_books = relationship("ShelfBook", back_populates="shelf", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=True)
    original_title = Column(String, nullable=True)
    author = Column(String, nullable=True)
    isbn = Column(String, nullable=True)
    language = Column(String, nullable=True, default="en")
    description = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    genres = Column(String, nullable=True)
    needs_review = Column(Boolean, default=False)
    confidence = Column(Float, nullable=True)
    review_notes = Column(String, nullable=True)
    bbox = Column(String, nullable=True)       # JSON [x, y, w, h] as fractions 0–1
    lent_to = Column(String, nullable=True)    # borrower's name, null = on shelf
    source = Column(String, default="extracted")
    created_at = Column(DateTime, default=datetime.utcnow)

    shelf_books = relationship("ShelfBook", back_populates="book", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="source_book", cascade="all, delete-orphan")


class ShelfBook(Base):
    __tablename__ = "shelf_books"

    shelf_id = Column(Integer, ForeignKey("shelves.id"), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"), primary_key=True)
    shelf_row = Column(Integer, default=1)        # 1 = topmost row
    position_in_row = Column(Integer, default=0)  # 0 = leftmost

    shelf = relationship("Shelf", back_populates="shelf_books")
    book = relationship("Book", back_populates="shelf_books")
