import { useState, useEffect, useRef } from 'react';
import BookSpine from './BookSpine.jsx';
import BookEditModal from './BookEditModal.jsx';
import { deleteBook, updateBook } from '../api.js';

const LANG_NAMES = {
  en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', ru: 'Russian', ja: 'Japanese', zh: 'Chinese',
  ko: 'Korean', ar: 'Arabic', he: 'Hebrew', pl: 'Polish', sv: 'Swedish',
  da: 'Danish', cs: 'Czech', hu: 'Hungarian', tr: 'Turkish', el: 'Greek',
  uk: 'Ukrainian', ro: 'Romanian',
};

export default function ShelfSpineView({ books, onUpdate, onDelete, shelfPhotoUrl, highlightBookId }) {
  const [selected, setSelected] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const highlightRef = useRef(null);

  // Scroll highlighted spine into view
  useEffect(() => {
    if (highlightBookId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [highlightBookId]);

  function handleSpineClick(book, e) {
    if (book.needs_review) {
      setSelected(null);
      setAnchor(null);
      setReviewing(book);
      return;
    }
    if (selected?.id === book.id) {
      setSelected(null);
      setAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setSelected(book);
    setAnchor({ x: rect.left + rect.width / 2, y: rect.top });
  }

  function handleClose() {
    setSelected(null);
    setAnchor(null);
  }

  // Group books by row, sort within each row by position
  const rowMap = {};
  books.forEach((book) => {
    const row = book.shelf_row || 1;
    if (!rowMap[row]) rowMap[row] = [];
    rowMap[row].push(book);
  });
  const rowKeys = Object.keys(rowMap)
    .map(Number)
    .sort((a, b) => a - b);
  rowKeys.forEach((key) => {
    rowMap[key].sort((a, b) => (a.position_in_row || 0) - (b.position_in_row || 0));
  });

  const multiRow = rowKeys.length > 1;

  return (
    <div className="relative select-none space-y-3">
      {rowKeys.map((rowKey) => (
        <div key={rowKey}>
          {multiRow && (
            <p className="text-xs text-stone-500 px-1 pb-1 font-medium tracking-wide">
              Row {rowKey}
            </p>
          )}
          <div className="overflow-x-auto" style={{ overscrollBehaviorX: 'contain' }}>
            <div className="flex items-end gap-px" style={{ minHeight: 200, paddingTop: 20 }}>
              {rowMap[rowKey].map((book) => {
                const isHighlighted = highlightBookId === book.id;
                return (
                  <div
                    key={book.id}
                    ref={isHighlighted ? highlightRef : null}
                    data-spine
                  >
                    <BookSpine
                      book={book}
                      onClick={handleSpineClick}
                      selected={selected?.id === book.id}
                      highlighted={isHighlighted}
                      height={180}
                    />
                  </div>
                );
              })}
              {rowMap[rowKey].length === 0 && (
                <div className="flex items-end pb-4 px-6 text-stone-500 text-sm italic">
                  Empty row
                </div>
              )}
            </div>
            {/* Shelf plank */}
            <div style={{
              height: 16,
              background: 'linear-gradient(to bottom, #d4aa72 0%, #b08040 40%, #8b6330 100%)',
              boxShadow: '0 3px 8px rgba(0,0,0,0.35)',
            }} />
            <div style={{
              height: 6,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.18), transparent)',
            }} />
          </div>
        </div>
      ))}

      {books.length === 0 && (
        <div className="flex items-center justify-center py-16 text-stone-500 text-sm italic">
          No books yet
        </div>
      )}

      {selected && anchor && (
        <BookPopover
          book={selected}
          anchorX={anchor.x}
          anchorY={anchor.y}
          onClose={handleClose}
          onUpdate={(updated) => { onUpdate(updated); handleClose(); }}
          onDelete={(id) => { onDelete(id); handleClose(); }}
        />
      )}

      {reviewing && (
        <BookEditModal
          book={reviewing}
          shelfPhotoUrl={shelfPhotoUrl}
          onSave={(updated) => { onUpdate(updated); setReviewing(null); }}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

function BookPopover({ book, anchorX, anchorY, onClose, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [lendMode, setLendMode] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const ref = useRef(null);
  const [pos, setPos] = useState({ visibility: 'hidden', position: 'fixed' });

  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    let left = anchorX - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    const top = Math.max(8, anchorY - h - 16);
    setPos({ position: 'fixed', left, top, visibility: 'visible' });
  }, [anchorX, anchorY]);

  useEffect(() => {
    function onDown(e) {
      if (!e.target.closest('[data-spine]') && !e.target.closest('[data-popover]')) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const lang = book.language ? LANG_NAMES[book.language] : null;

  return (
    <>
      <div ref={ref} data-popover style={pos}
        className="z-50 w-64 rounded-xl bg-white shadow-2xl border border-parchment-200 p-4 animate-fade-in"
      >
        <div className="flex gap-3">
          {book.cover_url ? (
            <img src={book.cover_url} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0 shadow-sm" />
          ) : (
            <div className="w-12 h-16 rounded flex-shrink-0 bg-stone-200" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug">
              {book.title || <span className="italic text-stone-400">Unidentified</span>}
            </p>
            {book.original_title && book.original_title !== book.title && (
              <p className="text-xs text-stone-400 italic mt-0.5 truncate">{book.original_title}</p>
            )}
            {book.author && <p className="text-xs text-stone-500 mt-0.5 truncate">{book.author}</p>}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {lang && lang !== 'English' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{lang}</span>
              )}
            </div>
          </div>
        </div>
        {book.description && (
          <p className="text-xs text-stone-500 mt-3 leading-relaxed line-clamp-3">{book.description}</p>
        )}

        {/* Lent status */}
        {book.lent_to && !lendMode && (
          <div className="mt-3 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
            <span className="text-xs text-amber-800">Lent to <strong>{book.lent_to}</strong></span>
            <button
              onClick={async () => {
                const updated = await updateBook(book.id, { lent_to: null });
                onUpdate(updated);
              }}
              className="text-xs text-amber-700 hover:underline whitespace-nowrap"
            >
              Mark returned
            </button>
          </div>
        )}

        {!book.lent_to && lendMode && (
          <div className="mt-3 flex gap-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Borrower's name"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && borrowerName.trim()) {
                  const updated = await updateBook(book.id, { lent_to: borrowerName.trim() });
                  onUpdate(updated);
                  setLendMode(false);
                  setBorrowerName('');
                } else if (e.key === 'Escape') {
                  setLendMode(false);
                  setBorrowerName('');
                }
              }}
              className="flex-1 text-xs border border-parchment-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              onClick={async () => {
                if (!borrowerName.trim()) return;
                const updated = await updateBook(book.id, { lent_to: borrowerName.trim() });
                onUpdate(updated);
                setLendMode(false);
                setBorrowerName('');
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium"
            >
              Lend
            </button>
            <button onClick={() => { setLendMode(false); setBorrowerName(''); }}
              className="text-xs px-2 py-1.5 rounded-lg hover:bg-stone-50 text-stone-400">
              &times;
            </button>
          </div>
        )}

        <div className="flex gap-1.5 mt-3">
          <button onClick={() => setEditing(true)}
            className="flex-1 text-xs py-1.5 rounded-lg border border-parchment-200 hover:bg-parchment-50 font-medium">
            Edit
          </button>
          {!book.lent_to && !lendMode && (
            <button onClick={() => setLendMode(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 text-amber-700">
              Lend
            </button>
          )}
          <button onClick={() => { if (confirm('Remove this book?')) onDelete(book.id); }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-600">
            Delete
          </button>
          <button onClick={onClose}
            className="text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-50 text-stone-400">
            &times;
          </button>
        </div>
      </div>
      {editing && (
        <BookEditModal
          book={book}
          onSave={(updated) => { onUpdate(updated); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
