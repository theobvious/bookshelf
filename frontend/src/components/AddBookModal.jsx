import { useState } from "react";
import { createBook } from "../api.js";

const LANGUAGES = [
  ["en", "English"], ["fr", "French"], ["de", "German"], ["es", "Spanish"],
  ["it", "Italian"], ["pt", "Portuguese"], ["nl", "Dutch"], ["ru", "Russian"],
  ["ja", "Japanese"], ["zh", "Chinese"], ["ko", "Korean"], ["ar", "Arabic"],
  ["he", "Hebrew"], ["pl", "Polish"], ["sv", "Swedish"], ["cs", "Czech"],
  ["hu", "Hungarian"], ["tr", "Turkish"], ["el", "Greek"], ["uk", "Ukrainian"],
];

const inputCls = "w-full px-3 py-2.5 text-sm bg-float border border-line rounded-xl text-chalk placeholder:text-smoke focus:outline-none focus:ring-1 focus:ring-ink-500/50 focus:border-ink-600/60 transition-colors";

export default function AddBookModal({ shelfId, onAdded, onClose }) {
  const [form, setForm] = useState({ title: "", original_title: "", author: "", language: "en", isbn: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAdd() {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const book = await createBook({
        title: form.title.trim(),
        original_title: form.original_title.trim() || form.title.trim(),
        author: form.author.trim() || null,
        language: form.language,
        isbn: form.isbn.trim() || null,
        shelf_id: shelfId,
        source: "manual",
      });
      onAdded(book);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-raised rounded-2xl shadow-2xl border border-line w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base text-chalk">Add book</h2>
          <button onClick={onClose} className="text-smoke hover:text-mist text-xl leading-none transition-colors">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-mist mb-1.5">Title *</label>
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
            onClick={handleAdd}
            disabled={saving || !form.title.trim()}
            className="px-4 py-2 text-sm rounded-xl bg-chalk text-deep font-medium hover:bg-chalk/90 disabled:opacity-40 transition-colors"
          >
            {saving ? "Adding…" : "Add book"}
          </button>
        </div>
      </div>
    </div>
  );
}
