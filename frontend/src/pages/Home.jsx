import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getShelves } from '../api.js';
import MiniShelfPreview from '../components/MiniShelfPreview.jsx';

export default function Home() {
  const [shelves, setShelves] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShelves().then((s) => {
      setShelves(s);
      setReviewCount(s.reduce((n, shelf) => n + shelf.needs_review_count, 0));
    }).finally(() => setLoading(false));
  }, []);

  const totalBooks = shelves.reduce((n, s) => n + s.book_count, 0);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-5 h-5 rounded-full border-2 border-ink-700 border-t-ink-300 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-chalk">Your library</h1>
        <p className="text-mist text-sm">
          {shelves.length} {shelves.length === 1 ? 'shelf' : 'shelves'}
          {totalBooks > 0 && <> &middot; {totalBooks} books</>}
          {reviewCount > 0 && (
            <> &middot; <Link to="/review" className="text-glow hover:text-glow-text transition-colors">{reviewCount} to review</Link></>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/shelves',         label: 'Shelves',      desc: `${shelves.length} total` },
          { to: '/search',          label: 'Search',       desc: 'Find a book' },
          { to: '/review',          label: 'Review',       desc: reviewCount > 0 ? `${reviewCount} waiting` : 'All clear', warn: reviewCount > 0 },
          { to: '/recommendations', label: 'Reading List', desc: 'What to read next' },
        ].map(({ to, label, desc, warn }) => (
          <Link
            key={label}
            to={to}
            className={`rounded-2xl border p-4 flex flex-col gap-1.5 transition-all ${
              warn
                ? 'border-glow-border bg-glow-bg hover:border-glow/40'
                : 'border-line bg-raised hover:border-edge hover:bg-float'
            }`}
          >
            <span className={`font-medium text-sm ${warn ? 'text-glow-text' : 'text-chalk'}`}>{label}</span>
            <span className={`text-xs ${warn ? 'text-glow-dim' : 'text-mist'}`}>{desc}</span>
          </Link>
        ))}
      </div>

      {shelves.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-smoke uppercase tracking-widest font-medium">Your shelves</p>
          <div className="space-y-3">
            {shelves.map((shelf) => (
              <Link
                key={shelf.id}
                to={`/shelves/${shelf.id}`}
                className="group block rounded-2xl border border-line bg-raised hover:border-edge transition-all overflow-hidden"
              >
                <div className="bg-deep px-4 pt-4">
                  <MiniShelfPreview shelfId={shelf.id} bookCount={shelf.book_count} height={80} />
                </div>
                <div className="px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-chalk group-hover:text-ink-200 transition-colors">
                      {shelf.label}
                    </span>
                    <span className="text-xs text-smoke">{shelf.book_count} books</span>
                    {shelf.needs_review_count > 0 && (
                      <span className="text-xs text-glow">{shelf.needs_review_count} to review</span>
                    )}
                  </div>
                  <span className="text-smoke text-base group-hover:text-mist transition-colors">›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {shelves.length === 0 && (
        <div className="text-center py-24 space-y-3">
          <p className="font-display italic text-2xl text-smoke">No shelves yet</p>
          <p className="text-sm text-mist">
            <Link to="/shelves" className="text-ink-400 hover:text-ink-300 transition-colors">Add your first shelf</Link>
            {' '}by uploading a photo.
          </p>
        </div>
      )}
    </div>
  );
}
