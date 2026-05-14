import { useState } from "react";
import { updateBook, confirmBook } from "../api.js";

const LANGUAGES = [
  ["en", "English"], ["fr", "French"], ["de", "German"], ["es", "Spanish"],
  ["it", "Italian"], ["pt", "Portuguese"], ["nl", "Dutch"], ["ru", "Russian"],
  ["ja", "Japanese"], ["zh", "Chinese"], ["ko", "Korean"], ["ar", "Arabic"],
  ["he", "Hebrew"], ["pl", "Polish"], ["sv", "Swedish"], ["da", "Danish"],
  ["fi", "Finnish"], ["no", "Norwegian"], ["cs", "Czech"], ["hu", "Hungarian"],
  ["tr", "Turkish"], ["el", "Greek"], ["ro", "Romanian"], ["uk", "Ukrainian"],
];

export default function BookEditModal({ book, onSave, onClose }) {
  const [form, setForm] = useState({
    title: book.title || "",
    original_title: book.original_title || "",
    author: book.author || "",
    language: book.language || "en",
    isbn: book.isbn || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
      };
      // If user filled in a title, auto-confirm
      if (book.needs_review && form.title) {
        payload.needs_review = false;
      }
      const updated = await updateBook(book.id, payload);
      onSave(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      // Save edits first, then confirm
      const payload = {
        title: form.title || null,
        original_title: form.original_title || form.title || null,
        author: form.author || null,
        language: form.language || null,
        isbn: form.isbn || null,
        needs_review: false,
      };
      const updated = await updateBook(book.id, payload);
      onSave(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">
            {book.needs_review ? "Review book" : "Edit book"}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">&times;</button>
        </div>

        {book.needs_review && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <strong>Claude couldn't read this spine clearly.</strong>
            {book.review_notes && <p className="mt-1 italic">{book.review_notes}</p>}
            {book.confidence != null && (
              <p className="mt-1">Confidence: {Math.round(book.confidence * 100)}%</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Book title"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Original title <span className="font-normal text-stone-400">(if different)</span>
            </label>
            <input
              type="text"
              value={form.original_title}
              onChange={(e) => set("original_title", e.target.value)}
              placeholder="Original language title"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Author</label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => set("author", e.target.value)}
              placeholder="Author name"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-stone-600 mb-1">Language</label>
              <select
                value={form.language}
                onChange={(e) => set("language", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {LANGUAGES.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-stone-600 mb-1">ISBN</label>
              <input
                type="text"
                value={form.isbn}
                onChange={(e) => set("isbn", e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-stone-200 hover:bg-stone-50"
          >
            Cancel
          </button>
          {book.needs_review ? (
            <button
              onClick={handleConfirm}
              disabled={saving || !form.title}
              className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Confirm & save"}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
