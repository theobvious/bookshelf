import { useState, useEffect } from "react";
import { updateBook, enrichBook } from "../api.js";
import SpineCrop from "./SpineCrop.jsx";
import PhotoViewer from "./PhotoViewer.jsx";

const LANGUAGES = [
  ["en", "English"], ["fr", "French"], ["de", "German"], ["es", "Spanish"],
  ["it", "Italian"], ["pt", "Portuguese"], ["nl", "Dutch"], ["ru", "Russian"],
  ["ja", "Japanese"], ["zh", "Chinese"], ["ko", "Korean"], ["ar", "Arabic"],
  ["he", "Hebrew"], ["pl", "Polish"], ["sv", "Swedish"], ["da", "Danish"],
  ["fi", "Finnish"], ["no", "Norwegian"], ["cs", "Czech"], ["hu", "Hungarian"],
  ["tr", "Turkish"], ["el", "Greek"], ["ro", "Romanian"], ["uk", "Ukrainian"],
];

const inputCls = "w-full px-3 py-2.5 text-sm bg-float border border-line rounded-xl text-chalk placeholder:text-smoke focus:outline-none focus:ring-1 focus:ring-ink-500/50 focus:border-ink-600/60 transition-colors";

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
  const [showViewer, setShowViewer] = useState(false);

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
    <div className="fixed inset-0 z-50 animate-fade-in">
      {/* Backdrop — separate layer so nothing inside the modal can accidentally trigger it */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      {/* Modal — rendered after backdrop so it sits on top in stacking order */}
      <div className="relative flex items-center justify-center min-h-full p-4">
      <div className="bg-raised rounded-2xl shadow-2xl border border-line w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base text-chalk">
            {book.needs_review ? "Review book" : "Edit book"}
          </h2>
          <button
            onClick={onClose}
            className="text-smoke hover:text-mist text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {book.needs_review && (
          <div className="mb-4 p-3.5 rounded-xl bg-glow-bg border border-glow-border text-sm text-glow-text">
            <div className="flex gap-3 items-start">
              {showPhotoSection && (
                <div className="flex-shrink-0">
                  {hasBbox ? (
                    <SpineCrop
                      photoUrl={shelfPhotoUrl}
                      bbox={book.bbox}
                      width={52}
                      height={110}
                      onClick={() => setShowViewer(true)}
                    />
                  ) : (
                    <img
                      src={shelfPhotoUrl}
                      alt="shelf"
                      onClick={() => setShowViewer(true)}
                      style={{ width: 72, height: 110, objectFit: 'cover', objectPosition: 'center', borderRadius: 8, cursor: 'zoom-in' }}
                    />
                  )}
                  <p className="text-xs text-glow-dim text-center mt-1">{hasBbox ? 'Spine' : 'Shelf'}</p>
                </div>
              )}
              <div>
                <strong className="text-glow-text">Spine wasn't legible.</strong>
                {book.review_notes && <p className="mt-1 text-glow-dim italic text-xs">{book.review_notes}</p>}
                {book.confidence != null && (
                  <p className="mt-1 text-xs text-smoke">Confidence: {Math.round(book.confidence * 100)}%</p>
                )}
              </div>
            </div>
          </div>
        )}

        {book.needs_review && (book.title || book.author) && (
          <p className="text-xs text-smoke italic mb-4">
            Pre-filled with Claude's best reading — correct anything that looks wrong.
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-mist mb-1.5">Title</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="Book title" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-mist mb-1.5">
              Original title <span className="font-normal text-smoke">(if different)</span>
            </label>
            <input type="text" value={form.original_title} onChange={(e) => set("original_title", e.target.value)}
              placeholder="Original language title" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-mist mb-1.5">Author</label>
            <input type="text" value={form.author} onChange={(e) => set("author", e.target.value)}
              placeholder="Author name" className={inputCls} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-mist mb-1.5">Language</label>
              <select value={form.language} onChange={(e) => set("language", e.target.value)} className={inputCls}>
                {LANGUAGES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-mist mb-1.5">ISBN</label>
              <input type="text" value={form.isbn} onChange={(e) => set("isbn", e.target.value)}
                placeholder="Optional" className={inputCls} />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-ember">{error}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-line hover:bg-float text-mist transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title}
            className="px-4 py-2 text-sm rounded-xl bg-chalk text-deep font-medium hover:bg-chalk/90 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : book.needs_review ? "Confirm & save" : "Save changes"}
          </button>
        </div>
      </div>
      </div>

      {showViewer && shelfPhotoUrl && (
        <PhotoViewer
          photoUrl={shelfPhotoUrl}
          bbox={hasBbox ? book.bbox : null}
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  );
}
