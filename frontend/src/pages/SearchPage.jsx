import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { searchBooks } from '../api.js';

const LANG_NAMES = {
  en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', ja: 'Japanese', zh: 'Chinese',
  ko: 'Korean', ar: 'Arabic', he: 'Hebrew', pl: 'Polish',
};

function locationLabel(loc) {
  return loc.shelf_row > 1
    ? `${loc.shelf_label} · Row ${loc.shelf_row}`
    : loc.shelf_label;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchBooks(query.trim());
        setResults(data);
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  return (
    <div className="space-y-7">
      <h1 className="text-2xl font-semibold tracking-tight text-chalk">Search</h1>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author…"
          autoFocus
          className="w-full px-4 py-3 pr-10 text-sm bg-raised border border-line rounded-2xl text-chalk placeholder:text-smoke focus:outline-none focus:ring-1 focus:ring-ink-500/50 focus:border-ink-600/60 transition-colors"
        />
        {loading && (
          <div className="absolute right-3.5 top-3.5">
            <div className="w-4 h-4 rounded-full border-2 border-ink-700 border-t-ink-400 animate-spin" />
          </div>
        )}
        {!loading && query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-2.5 text-smoke hover:text-mist text-xl leading-none transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {searched && results.length === 0 && (
        <p className="text-sm text-mist text-center py-10">
          No books found for &ldquo;{query}&rdquo;
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-smoke">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          {results.map(({ book, locations }) => {
            const lang = book.language && LANG_NAMES[book.language];
            return (
              <div key={book.id} className="flex gap-3 p-3.5 rounded-2xl border border-line bg-raised hover:border-edge transition-colors">
                <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-float">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug text-chalk">
                    {book.title || <span className="italic text-smoke">Unidentified</span>}
                  </p>
                  {book.author && <p className="text-xs text-mist mt-0.5">{book.author}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {lang && lang !== 'English' && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-ink-900 border border-ink-800 text-ink-300">
                        {lang}
                      </span>
                    )}
                    {locations.map((loc) => (
                      <Link
                        key={loc.shelf_id}
                        to={`/shelves/${loc.shelf_id}?highlight=${book.id}`}
                        className="text-xs text-ink-400 hover:text-ink-300 transition-colors"
                      >
                        {locationLabel(loc)}
                      </Link>
                    ))}
                    {book.lent_to && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-glow-bg border border-glow-border text-glow">
                        Lent to {book.lent_to}
                      </span>
                    )}
                    {book.needs_review && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-glow-bg border border-glow-border text-glow-dim">
                        Needs review
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!searched && !query && (
        <div className="text-center py-20 space-y-1">
          <p className="text-sm text-mist">Type to search your catalog</p>
          <p className="text-xs text-smoke">Titles, original titles, and authors — in any language</p>
        </div>
      )}
    </div>
  );
}
