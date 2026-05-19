import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { getShelf, deleteBook, getShelfRecommendations } from '../api.js';
import ShelfSpineView from '../components/ShelfSpineView.jsx';
import BookCard from '../components/BookCard.jsx';
import AddBookModal from '../components/AddBookModal.jsx';

export default function ShelfDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const highlightBookId = searchParams.get('highlight') ? parseInt(searchParams.get('highlight')) : null;
  const [shelf, setShelf] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('spines');
  const [showAddBook, setShowAddBook] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getShelf(id)
      .then((data) => {
        setShelf(data);
        setBooks(data.books || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleBookUpdated(updated) {
    setBooks((prev) => prev.map((b) => {
      if (b.id !== updated.id) return b;
      return { ...updated, shelf_row: b.shelf_row, position_in_row: b.position_in_row };
    }));
  }

  async function handleBookDeleted(bookId) {
    if (!confirm('Remove this book from the catalog?')) return;
    await deleteBook(bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  }

  function handleBookAdded(book) {
    setBooks((prev) => [...prev, book]);
    setShowAddBook(false);
  }

  async function loadRecommendations() {
    setRecsLoading(true);
    try {
      await getShelfRecommendations(id);
      navigate('/recommendations');
    } catch {
      setRecsLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-5 h-5 rounded-full border-2 border-ink-700 border-t-ink-300 animate-spin" />
    </div>
  );
  if (!shelf) return <p className="text-ember text-sm">Shelf not found.</p>;

  const confirmed = books.filter((b) => !b.needs_review);
  const needsReview = books.filter((b) => b.needs_review);

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/shelves" className="text-xs text-smoke hover:text-mist transition-colors">
            ← Shelves
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-chalk mt-1">{shelf.label}</h1>
          <p className="text-sm text-mist mt-1">
            {books.length} book{books.length !== 1 ? 's' : ''}
            {needsReview.length > 0 && (
              <span className="ml-2 text-glow">{needsReview.length} to review</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex rounded-xl border border-line overflow-hidden text-xs">
            <button
              onClick={() => setView('spines')}
              className={`px-3 py-1.5 transition-colors ${
                view === 'spines' ? 'bg-float text-chalk' : 'text-mist hover:text-chalk hover:bg-raised'
              }`}
            >
              Spines
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 transition-colors ${
                view === 'list' ? 'bg-float text-chalk' : 'text-mist hover:text-chalk hover:bg-raised'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Spine view */}
      {view === 'spines' && (
        <div className="rounded-2xl border border-line bg-deep overflow-hidden px-4 pt-4">
          <ShelfSpineView
            books={books}
            onUpdate={handleBookUpdated}
            onDelete={handleBookDeleted}
            shelfPhotoUrl={shelf.photo_path}
            highlightBookId={highlightBookId}
          />
        </div>
      )}

      {/* Actions bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAddBook(true)}
          className="text-xs px-3 py-1.5 rounded-lg border border-line hover:bg-raised text-mist hover:text-chalk transition-colors"
        >
          + Add book
        </button>
        <button
          onClick={loadRecommendations}
          disabled={recsLoading || confirmed.length === 0}
          className="text-xs px-3 py-1.5 rounded-lg bg-ink-900 border border-ink-800 text-ink-300 hover:bg-ink-800/60 disabled:opacity-40 transition-colors"
        >
          {recsLoading ? 'Thinking…' : 'Recommend books'}
        </button>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-5">
          {needsReview.length > 0 && (
            <div>
              <p className="text-xs text-glow-dim uppercase tracking-widest font-medium mb-3">
                Needs review ({needsReview.length})
              </p>
              <div className="space-y-2">
                {needsReview.map((book) => (
                  <BookCard key={book.id} book={book} onUpdate={handleBookUpdated} onDelete={handleBookDeleted} />
                ))}
              </div>
            </div>
          )}
          {confirmed.length > 0 && (
            <div>
              <p className="text-xs text-smoke uppercase tracking-widest font-medium mb-3">Books</p>
              <div className="space-y-2">
                {confirmed.map((book) => (
                  <BookCard key={book.id} book={book} onUpdate={handleBookUpdated} onDelete={handleBookDeleted} />
                ))}
              </div>
            </div>
          )}
          {books.length === 0 && (
            <p className="text-sm text-mist text-center py-12">No books on this shelf yet.</p>
          )}
        </div>
      )}

      {showAddBook && (
        <AddBookModal
          shelfId={parseInt(id)}
          onAdded={handleBookAdded}
          onClose={() => setShowAddBook(false)}
        />
      )}
    </div>
  );
}
