import { useState, useEffect, useRef } from 'react';
import { searchBooks } from '../api.js';

const LANG_NAMES = {
  en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', ja: 'Japanese', zh: 'Chinese',
  ko: 'Korean', ar: 'Arabic', he: 'Hebrew', pl: 'Polish',
};

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
    <div className="space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Search</h1>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author…"
          autoFocus
          className="w-full px-4 py-3 pr-10 text-sm border border-stone-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        {loading && (
          <svg className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-stone-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        )}
        {!loading && query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 text-lg leading-none"
          >
            &times;
          </button>
        )}
      </div>

      {searched && results.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-8">
          No books found for &ldquo;{query}&rdquo;.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-stone-400">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          {results.map(({ book, shelf_labels }) => {
            const lang = book.language && LANG_NAMES[book.language];
            return (
              <div
                key={book.id}
                className="flex gap-3 p-3 rounded-lg border border-stone-200 bg-white"
              >
                <div className="flex-shrink-0 w-10 h-14 rounded overflow-hidden bg-stone-100">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-stone-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug">
                    {book.title || <span className="italic text-stone-400">Unidentified</span>}
                  </p>
                  {book.author && <p className="text-xs text-stone-500">{book.author}</p>}
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {lang && lang !== 'English' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {lang}
                      </span>
                    )}
                    {shelf_labels.length > 0 && (
                      <span className="text-xs text-stone-400">
                        {shelf_labels.join(', ')}
                      </span>
                    )}
                    {book.needs_review && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
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
        <div className="text-center py-16 text-stone-400">
          <p className="text-sm">Type to search your catalog</p>
          <p className="text-xs mt-1">Searches titles, original titles, and authors — in any language</p>
        </div>
      )}
    </div>
  );
}
