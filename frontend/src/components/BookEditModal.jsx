import { useState, useEffect } from "react";
import { updateBook, enrichBook } from "../api.js";
import SpineCrop from "./SpineCrop.jsx";

const LANGUAGES = [
  ["en", "English"], ["fr", "French"], ["de", "German"], ["es", "Spanish"],
  ["it", "Italian"], ["pt", "Portuguese"], ["nl", "Dutch"], ["ru", "Russian"],
  ["ja", "Japanese"], ["zh", "Chinese"], ["ko", "Korean"], ["ar", "Arabic"],
  ["he", "Hebrew"], ["pl", "Polish"], ["sv", "Swedish"], ["da", "Danish"],
  ["fi", "Finnish"], ["no", "Norwegian"], ["cs", "Czech"], ["hu", "Hungarian"],
  ["tr", "Turkish"], ["el", "Greek"], ["ro", "Romanian"], ["uk", "Ukrainian"],
];

const inputClass = "w-full px-3 py-2 text-sm border border-parchment-200 rounded-lg bg-parchment-50 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white transition-colors";

export default function BookEditModal({ book, shelfPhotoUrl, onSave, onClose }) {
  const [form, setForm] = useState({
    title: book.title || "",
    original_title: book.original_title || "",
    author: book.author || "",
    language: book.language || "en",
    isbn: book.isbn || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-enrich on open when reviewing a book that has a title but no author
  useEffect(() => {
    if (!book.needs_review || !book.title || book.author) return;
    enrichBook(book.id).then((enriched) => {
      if (enriched.author) setForm((f) => ({ ...f, author: f.author || enriched.author }));
      if (enriched.isbn && !form.isbn) setForm((f) => ({ ...f, isbn: f.isbn || enriched.isbn }));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title || null,
        original_title: form.original_title || form.title || null,
        author: form.author || null,
        language: form.language || null,
        isbn: form.isbn || null,
        ...(book.needs_review && form.title ? { needs_review: false } : {}),
      };
      onSave(await updateBook(book.id, payload));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const hasBbox = book.bbox && book.bbox.length === 4;
  const showPhotoSection = !!shelfPhotoUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-parchment-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base text-stone-900">
            {book.needs_review ? "Review book" : "Edit book"}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">&times;</button>
        </div>

        {book.needs_review && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <div className="flex gap-3 items-start">
              {showPhotoSection && (
                <div className="flex-shrink-0">
                  {hasBbox ? (
                    <SpineCrop photoUrl={shelfPhotoUrl} bbox={book.bbox} width={52} height={110} />
                  ) : (
                    <img
                      src={shelfPhotoUrl}
                      alt="shelf"
                      style={{ width: 72, height: 110, objectFit: 'cover', objectPosition: 'center', borderRadius: 4 }}
                    />
                  )}
                  <p className="text-xs text-amber-700 text-center mt-1">{hasBbox ? 'Spine' : 'Shelf'}</p>
                </div>
              )}
              <div>
                <strong>Couldn't read this spine clearly.</strong>
                {book.review_notes && <p className="mt-1 italic">{book.review_notes}</p>}
                {book.confidence != null && (
                  <p className="mt-1 text-xs">Confidence: {Math.round(book.confidence * 100)}%</p>
                )}
              </div>
            </div>
          </div>
        )}

        {book.needs_review && (book.title || book.author) && (
          <p className="text-xs text-stone-400 italic mb-3">
            Fields pre-filled with Claude's best reading — correct anything that looks wrong.
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="Book title" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Original title <span className="font-normal text-stone-400">(if different)</span>
            </label>
            <input type="text" value={form.original_title} onChange={(e) => set("original_title", e.target.value)}
              placeholder="Original language title" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Author</label>
            <input type="text" value={form.author} onChange={(e) => set("author", e.target.value)}
              placeholder="Author name" className={inputClass} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-stone-500 mb-1">Language</label>
              <select value={form.language} onChange={(e) => set("language", e.target.value)} className={inputClass}>
                {LANGUAGES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-stone-500 mb-1">ISBN</label>
              <input type="text" value={form.isbn} onChange={(e) => set("isbn", e.target.value)}
                placeholder="Optional" className={inputClass} />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-parchment-200 hover:bg-parchment-50 text-stone-600">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.title}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${
              book.needs_review ? "bg-amber-700 hover:bg-amber-800" : "bg-stone-800 hover:bg-stone-700"
            }`}>
            {saving ? "Saving…" : book.needs_review ? "Confirm & save" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
