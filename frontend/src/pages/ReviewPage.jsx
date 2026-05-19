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

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-5 h-5 rounded-full border-2 border-ink-700 border-t-ink-300 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-chalk">Review</h1>
        <p className="text-mist text-sm mt-1">
          {books.length === 0
            ? 'All clear — no books need review.'
            : `${books.length} book${books.length !== 1 ? 's' : ''} where the spine wasn't legible.`}
        </p>
      </div>

      {books.length > 0 && (
        <>
          <div className="px-4 py-3 rounded-2xl bg-glow-bg border border-glow-border text-sm text-glow-text leading-relaxed">
            Open any book to fill in the correct title, author, and language, then hit
            {' '}<span className="font-medium">Confirm &amp; save</span> to add it to your catalog.
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
        <div className="text-center py-24 space-y-2">
          <p className="font-display italic text-2xl text-smoke">All reviewed</p>
          <p className="text-sm text-mist">Every book in your catalog has been confirmed.</p>
        </div>
      )}
    </div>
  );
}
