from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from database import Base


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
    title = Column(String, nullable=True)          # as written on spine / by user
    original_title = Column(String, nullable=True) # if different from display title
    author = Column(String, nullable=True)
    isbn = Column(String, nullable=True)
    language = Column(String, nullable=True, default="en")
    description = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    genres = Column(String, nullable=True)          # JSON-serialized list
    needs_review = Column(Boolean, default=False)
    confidence = Column(Float, nullable=True)
    review_notes = Column(String, nullable=True)   # Claude's uncertainty notes
    source = Column(String, default="extracted")   # "extracted" | "manual"
    created_at = Column(DateTime, default=datetime.utcnow)

    shelf_books = relationship("ShelfBook", back_populates="book", cascade="all, delete-orphan")


class ShelfBook(Base):
    __tablename__ = "shelf_books"

    shelf_id = Column(Integer, ForeignKey("shelves.id"), primary_key=True)
    book_id = Column(Integer, ForeignKey("books.id"), primary_key=True)

    shelf = relationship("Shelf", back_populates="shelf_books")
    book = relationship("Book", back_populates="shelf_books")
