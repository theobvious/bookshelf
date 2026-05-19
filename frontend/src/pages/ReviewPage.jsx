import { useEffect, useState } from 'react';
import { getBooks, deleteBook } from '../api.js';
import BookCard from '../components/BookCard.jsx';

export default function ReviewPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBooks({ needs_review: true }).then(setBooks).finally(() => setLoading(false));
  }, []);

  function handleUpdated(updated) {
    if (!updated.needs_review) {
      setBooks((prev) => prev.filter((b) => b.id !== updated.id));
    } else {
      setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    }
  }

  async function handleDeleted(bookId) {
    if (!confirm('Remove this book from the catalog?')) return;
    await deleteBook(bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  }

  if (loading) return <p className="text-stone-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-stone-500 text-sm mt-1">
          {books.length === 0
            ? 'All clear — no books need review.'
            : `${books.length} book${books.length !== 1 ? 's' : ''} where Claude couldn't read the spine clearly.`}
        </p>
      </div>

      {books.length > 0 && (
        <>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            Click <strong>Edit</strong> on any book to fill in the correct title, author, and language, then
            hit <strong>Confirm &amp; save</strong> to add it to your catalog.
          </div>
          <div className="space-y-2">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onUpdate={handleUpdated}
                onDelete={handleDeleted}
                showShelf
                shelfLabels={[]}
              />
            ))}
          </div>
        </>
      )}

      {books.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-sm text-stone-600">All books have been reviewed.</p>
        </div>
      )}
    </div>
  );
}
