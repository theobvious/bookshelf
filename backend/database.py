from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./bookshelf.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Enable WAL mode and foreign keys for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Base  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Create FTS5 virtual table for full-text search
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS books_fts
            USING fts5(title, original_title, author, content='books', content_rowid='id')
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS books_ai AFTER INSERT ON books BEGIN
                INSERT INTO books_fts(rowid, title, original_title, author)
                VALUES (new.id, COALESCE(new.title,''), COALESCE(new.original_title,''), COALESCE(new.author,''));
            END
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS books_au AFTER UPDATE ON books BEGIN
                INSERT INTO books_fts(books_fts, rowid, title, original_title, author)
                VALUES ('delete', old.id, COALESCE(old.title,''), COALESCE(old.original_title,''), COALESCE(old.author,''));
                INSERT INTO books_fts(rowid, title, original_title, author)
                VALUES (new.id, COALESCE(new.title,''), COALESCE(new.original_title,''), COALESCE(new.author,''));
            END
        """))
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS books_ad AFTER DELETE ON books BEGIN
                INSERT INTO books_fts(books_fts, rowid, title, original_title, author)
                VALUES ('delete', old.id, COALESCE(old.title,''), COALESCE(old.original_title,''), COALESCE(old.author,''));
            END
        """))
        # Migrations: add new columns if they don't exist yet
        for stmt in [
            "ALTER TABLE books ADD COLUMN bbox TEXT",
            "ALTER TABLE shelf_books ADD COLUMN shelf_row INTEGER DEFAULT 1",
            "ALTER TABLE shelf_books ADD COLUMN position_in_row INTEGER DEFAULT 0",
        ]:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass  # column already exists
        conn.commit()
