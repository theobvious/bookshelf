import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getShelves, getBooks } from '../api.js';
import MiniShelfPreview from '../components/MiniShelfPreview.jsx';

export default function Home() {
  const [shelves, setShelves] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getShelves(), getBooks({ needs_review: true })])
      .then(([s, r]) => {
        setShelves(s);
        setReviewCount(r.length);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalBooks = shelves.reduce((n, s) => n + s.book_count, 0);

  if (loading) return <p className="text-stone-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your library</h1>
        <p className="text-stone-500 text-sm mt-1">
          {shelves.length} {shelves.length === 1 ? 'shelf' : 'shelves'} &middot; {totalBooks} books
          {reviewCount > 0 && (
            <>
              {' '}&middot;{' '}
              <Link to="/review" className="text-amber-700 hover:underline font-medium">
                {reviewCount} needing review
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/shelves', label: 'Shelves', desc: `${shelves.length} shelves` },
          { to: '/search', label: 'Search', desc: 'Find a book' },
          { to: '/review', label: 'Review queue', desc: `${reviewCount} to review`, warn: reviewCount > 0 },
          { to: '/shelves', label: 'Add shelf', desc: 'Upload a photo' },
        ].map(({ to, label, desc, warn }) => (
          <Link
            key={label}
            to={to}
            className={`rounded-xl border p-4 flex flex-col gap-1 transition-colors hover:shadow-sm ${
              warn
                ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                : 'border-stone-200 bg-white hover:bg-stone-50'
            }`}
          >
            <span className="font-medium text-sm">{label}</span>
            <span className="text-xs text-stone-500">{desc}</span>
          </Link>
        ))}
      </div>

      {/* Shelves with mini spine previews */}
      {shelves.length > 0 && (
        <div>
          <h2 className="font-medium text-sm text-stone-500 uppercase tracking-wide mb-3">Your shelves</h2>
          <div className="space-y-3">
            {shelves.map((shelf) => (
              <Link
                key={shelf.id}
                to={`/shelves/${shelf.id}`}
                className="block rounded-xl border border-stone-200 bg-white hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="bg-stone-900 px-4 pt-4">
                  <MiniShelfPreview shelfId={shelf.id} bookCount={shelf.book_count} height={72} />
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{shelf.label}</span>
                    <span className="text-xs text-stone-400 ml-3">{shelf.book_count} books</span>
                    {shelf.needs_review_count > 0 && (
                      <span className="text-xs text-amber-700 ml-2">{shelf.needs_review_count} to review</span>
                    )}
                  </div>
                  <span className="text-stone-300 text-sm">&#8250;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {shelves.length === 0 && (
        <div className="text-center py-16 text-stone-400">
          <p className="font-medium text-stone-600">No shelves yet</p>
          <p className="text-sm mt-1">
            Go to{' '}
            <Link to="/shelves" className="text-amber-700 hover:underline">
              Shelves
            </Link>{' '}
            to upload your first photo.
          </p>
        </div>
      )}
    </div>
  );
}
