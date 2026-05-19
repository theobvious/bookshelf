import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getShelf, deleteBook, getRecommendations } from '../api.js';
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
  const [recs, setRecs] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState(null);

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
    setRecsError(null);
    try {
      setRecs(await getRecommendations(id));
    } catch (e) {
      setRecsError(e.message);
    } finally {
      setRecsLoading(false);
    }
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading…</p>;
  if (!shelf) return <p className="text-red-600 text-sm">Shelf not found.</p>;

  const confirmed = books.filter((b) => !b.needs_review);
  const needsReview = books.filter((b) => b.needs_review);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/shelves" className="text-xs text-stone-400 hover:text-stone-600">
            &larr; Shelves
          </Link>
          <h1 className="text-xl font-semibold mt-0.5">{shelf.label}</h1>
          <p className="text-sm text-stone-500 mt-1">
            {confirmed.length} book{confirmed.length !== 1 ? 's' : ''}
            {needsReview.length > 0 && (
              <span className="ml-2 text-amber-700">{needsReview.length} needing review</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex rounded-lg border border-stone-200 overflow-hidden text-xs">
            <button
              onClick={() => setView('spines')}
              className={`px-3 py-1.5 ${view === 'spines' ? 'bg-stone-800 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
            >
              Spines
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 ${view === 'list' ? 'bg-stone-800 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Spine view */}
      {view === 'spines' && (
        <div className="rounded-xl border border-stone-200 bg-stone-900 overflow-hidden p-4 pb-0">
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
          className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50"
        >
          + Add book manually
        </button>
        <button
          onClick={loadRecommendations}
          disabled={recsLoading || confirmed.length === 0}
          className="text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
        >
          {recsLoading ? 'Thinking…' : 'Recommend books'}
        </button>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="space-y-4">
          {needsReview.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-amber-700 mb-2">
                Needs review ({needsReview.length})
              </h2>
              <div className="space-y-2">
                {needsReview.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onUpdate={handleBookUpdated}
                    onDelete={handleBookDeleted}
                  />
                ))}
              </div>
            </div>
          )}
          {confirmed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-stone-500 mb-2">Books</h2>
              <div className="space-y-2">
                {confirmed.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onUpdate={handleBookUpdated}
                    onDelete={handleBookDeleted}
                  />
                ))}
              </div>
            </div>
          )}
          {books.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-8">No books on this shelf yet.</p>
          )}
        </div>
      )}

      {/* Recommendations */}
      {(recs || recsError) && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-base mb-1">Book recommendations</h2>
          {recsError && <p className="text-sm text-red-600">{recsError}</p>}
          {recs && (
            <>
              <p className="text-sm text-stone-500 italic mb-4">{recs.theme}</p>
              <div className="space-y-3">
                {recs.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-stone-300 text-sm font-mono mt-0.5 w-4 flex-shrink-0">{i + 1}.</span>
                    <div>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-stone-500">{rec.author}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
